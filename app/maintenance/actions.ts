"use server";

import * as fs from "fs";
import * as path from "path";
import { execFileSync } from "node:child_process";
import { revalidatePath } from "next/cache";
import { createAdminClient } from "../../lib/supabase/admin";
import { MaintenanceReport, MaintenanceTicket } from "../../lib/types/database";
import * as inventoryRepo from "../../lib/repositories/inventory";
import * as externalTicketsRepo from "../../lib/repositories/external-maintenance-tickets";
import * as settingsRepo from "../../lib/repositories/settings";
import {
    FIRESTORE_READONLY_SOURCE_SYSTEM,
    normalizeNorthReportRows,
    SOURCE_SYSTEM,
} from "../../lib/maintenance/external-ticket-normalizer";
import { mergeExternalTicketsForUpsert } from "../../lib/maintenance/external-ticket-merge";

const BROWSER_FULL_BASELINE_PATH = path.join(
    process.cwd(),
    "tmp",
    "browser-north-pending-in-progress-all-time.normalized.json",
);
const NORTH_CONTACTS_PATH = path.join(
    process.cwd(),
    "maintenance-probe",
    "probe-output",
    "console",
    "north-contacts.normalized.json",
);
const FIRESTORE_READER_SCRIPT_PATH = path.join(process.cwd(), "tmp", "firestore-north-sync-reader.js");
const FIRESTORE_SNAPSHOT_SOURCE_PATH = path.join(process.cwd(), "tmp", "firestore-north-reports.normalized.json");
const FIRESTORE_OUTPUT_PATH = path.join(
    process.cwd(),
    "tmp",
    "firestore-north-reports.in-progress.browser-list.normalized.json",
);
const MAINTENANCE_NORTH_SYNC_SETTING_ID = "maintenance_north_sync_status";
// Keep browser as the current safe default until live Firestore verify passes.
const DEFAULT_MAINTENANCE_NORTH_SYNC_SOURCE = "browser";
const REQUIRED_BROWSER_FULL_BASELINE_STATUSES = ["待處理", "處理中"];
const BROWSER_FULL_BASELINE_MAX_AGE_MINUTES = Number(
    process.env.MAINTENANCE_BROWSER_FULL_BASELINE_MAX_AGE_MINUTES || "60",
);

type SyncTrigger = "manual" | "auto" | "read_fallback";
type SyncState = "idle" | "syncing" | "success" | "failed";
type MaintenanceNorthSyncSource = "browser" | "firestore-readonly";
type MaintenanceNorthSyncMode = "browser-full-baseline" | "snapshot-remap" | "live-firestore";

type BasicReportRow = {
    id: string;
    external_ticket_id: string | null;
    case_no: string | null;
    case_name: string;
    workflow_state: string | null;
};

type PendingTicketView = {
    id: string;
    external_ticket_id: string;
    fallback_key: string;
    region: string;
    case_name: string;
    case_no: string;
    report_time: string;
    reporter: string;
    issue_summary: string;
    monitor_staff: string;
    monitor_judgement: string;
    repair_staff: string;
    repair_status: string;
    work_date: string;
    complete_date: string;
    workflow_state: string | null;
    optimizer_count: number | null;
    conflict_status: string | null;
    external_note: string;
    source: string;
    source_of_truth: "external";
};

export type MaintenanceNorthSyncStatus = {
    status: SyncState;
    last_sync_at: string | null;
    last_success_at: string | null;
    last_error: string | null;
    trigger: SyncTrigger | null;
    synced_count: number;
    needs_refresh_count: number;
    source_of_truth: "external";
    identity_mode: "fallback_key";
    sync_source: MaintenanceNorthSyncSource;
    sync_mode: MaintenanceNorthSyncMode | null;
};

const DEFAULT_SYNC_STATUS: MaintenanceNorthSyncStatus = {
    status: "idle",
    last_sync_at: null,
    last_success_at: null,
    last_error: null,
    trigger: null,
    synced_count: 0,
    needs_refresh_count: 0,
    source_of_truth: "external",
    identity_mode: "fallback_key",
    sync_source: "browser",
    sync_mode: null,
};

function isMaintenanceNorthSyncSource(value: string | null | undefined): value is MaintenanceNorthSyncSource {
    return value === "browser" || value === "firestore-readonly";
}

function resolveMaintenanceNorthSyncSource(
    sourceOverride?: MaintenanceNorthSyncSource,
): MaintenanceNorthSyncSource {
    if (sourceOverride && isMaintenanceNorthSyncSource(sourceOverride)) {
        return sourceOverride;
    }

    const envSource = process.env.MAINTENANCE_NORTH_SYNC_SOURCE;
    if (isMaintenanceNorthSyncSource(envSource)) {
        return envSource;
    }

    return DEFAULT_MAINTENANCE_NORTH_SYNC_SOURCE;
}

function resolveSourceSystem(syncSource: MaintenanceNorthSyncSource) {
    return syncSource === "firestore-readonly" ? FIRESTORE_READONLY_SOURCE_SYSTEM : SOURCE_SYSTEM;
}

function safeRevalidateMaintenance() {
    try {
        revalidatePath("/maintenance");
    } catch (error) {
        console.warn("[actions] revalidatePath(/maintenance) skipped:", error);
    }
}

function readProbeArtifact(filePath: string) {
    if (!fs.existsSync(filePath)) {
        return {
            data: [],
            meta: null,
            generatedAt: null,
        };
    }

    const rawJson = fs.readFileSync(filePath, "utf8");
    const parsed = JSON.parse(rawJson);
    const meta =
        parsed.meta && typeof parsed.meta === "object" && !Array.isArray(parsed.meta)
            ? parsed.meta
            : null;

    return {
        data: Array.isArray(parsed.data) ? parsed.data : [],
        meta,
        generatedAt:
            typeof parsed.generatedAt === "string"
                ? parsed.generatedAt
                : typeof meta?.generatedAt === "string"
                    ? meta.generatedAt
                    : null,
    };
}

function readProbeJson(filePath: string) {
    return readProbeArtifact(filePath).data;
}

function loadBrowserFullBaselineRows() {
    const artifact = readProbeArtifact(BROWSER_FULL_BASELINE_PATH);
    const validationErrors: string[] = [];
    const meta = artifact.meta as Record<string, unknown> | null;
    const includedStatuses = Array.isArray(meta?.included_statuses)
        ? meta.included_statuses.map((value) => String(value))
        : [];
    const territory = typeof meta?.territory === "string" ? meta.territory : null;
    const allTime = meta?.all_time === true;
    const source = typeof meta?.source === "string" ? meta.source : null;
    const view = typeof meta?.view === "string" ? meta.view : null;
    const generatedAt = artifact.generatedAt ? Date.parse(artifact.generatedAt) : NaN;
    const ageMinutes = Number.isFinite(generatedAt)
        ? Math.max(0, Math.round((Date.now() - generatedAt) / 60000))
        : NaN;

    if (!fs.existsSync(BROWSER_FULL_BASELINE_PATH)) {
        validationErrors.push(`browser full baseline missing: ${BROWSER_FULL_BASELINE_PATH}`);
    }
    if (source !== "browser-live-page") {
        validationErrors.push(`expected browser-live-page source, got ${String(source)}`);
    }
    if (view !== "browser-list") {
        validationErrors.push(`expected browser-list view, got ${String(view)}`);
    }
    if (territory !== "北區") {
        validationErrors.push(`expected 北區 territory, got ${String(territory)}`);
    }
    if (!allTime) {
        validationErrors.push("browser full baseline must be captured with all_time=true");
    }
    for (const status of REQUIRED_BROWSER_FULL_BASELINE_STATUSES) {
        if (!includedStatuses.includes(status)) {
            validationErrors.push(`browser full baseline missing required status: ${status}`);
        }
    }
    if (artifact.data.length === 0) {
        validationErrors.push("browser full baseline contains 0 rows");
    }
    if (typeof meta?.totalRows === "number" && meta.totalRows !== artifact.data.length) {
        validationErrors.push(
            `browser full baseline totalRows(${String(meta.totalRows)}) != data.length(${artifact.data.length})`,
        );
    }
    if (!Number.isFinite(generatedAt)) {
        validationErrors.push("browser full baseline generatedAt missing or invalid");
    } else if (ageMinutes > BROWSER_FULL_BASELINE_MAX_AGE_MINUTES) {
        validationErrors.push(
            `browser full baseline is stale (${ageMinutes}m > ${BROWSER_FULL_BASELINE_MAX_AGE_MINUTES}m)`,
        );
    }

    if (validationErrors.length > 0) {
        throw new Error(`Browser full baseline validation failed: ${validationErrors.join("; ")}`);
    }

    return {
        rows: artifact.data,
        mode: "browser-full-baseline" as MaintenanceNorthSyncMode,
        artifactPath: BROWSER_FULL_BASELINE_PATH,
    };
}

function hasLiveFirestoreCredentials() {
    return Boolean(
        (process.env.FIREBASE_EMAIL || process.env.COMPANY_EMAIL) &&
        (process.env.FIREBASE_PASSWORD || process.env.COMPANY_PASSWORD),
    );
}

function runFirestoreReadonlyReader() {
    const env: Record<string, string | undefined> = {
        ...process.env,
        FIRESTORE_TARGET_TERRITORY: "\u5317\u5340",
        FIRESTORE_REPAIR_STATUSES: "\u5f85\u8655\u7406,\u8655\u7406\u4e2d",
        OUTPUT_PATH: FIRESTORE_OUTPUT_PATH,
    };

    const mode: MaintenanceNorthSyncMode = hasLiveFirestoreCredentials()
        ? "live-firestore"
        : "snapshot-remap";

    if (mode === "snapshot-remap") {
        env.SOURCE_JSON_PATH = FIRESTORE_SNAPSHOT_SOURCE_PATH;
    }

    execFileSync(process.execPath, [FIRESTORE_READER_SCRIPT_PATH], {
        cwd: process.cwd(),
        env,
        stdio: "pipe",
    });

    return {
        rows: readProbeJson(FIRESTORE_OUTPUT_PATH),
        mode,
        artifactPath: FIRESTORE_OUTPUT_PATH,
    };
}

function loadNorthSyncRows(syncSource: MaintenanceNorthSyncSource) {
    if (syncSource === "firestore-readonly") {
        return runFirestoreReadonlyReader();
    }

    return loadBrowserFullBaselineRows();
}

async function countNorthNeedsRefresh() {
    const supabase = createAdminClient();
    const { count, error } = await supabase
        .from("external_maintenance_tickets")
        .select("*", { count: "exact", head: true })
        .eq("is_north", true)
        .eq("conflict_status", "needs_refresh");

    if (error) {
        throw error;
    }

    return count || 0;
}

async function writeMaintenanceNorthSyncStatus(nextStatus: Partial<MaintenanceNorthSyncStatus>) {
    const currentStatus =
        (await settingsRepo.getSetting<MaintenanceNorthSyncStatus>(MAINTENANCE_NORTH_SYNC_SETTING_ID)) ||
        DEFAULT_SYNC_STATUS;

    const mergedStatus: MaintenanceNorthSyncStatus = {
        ...currentStatus,
        ...nextStatus,
        source_of_truth: "external",
        identity_mode: "fallback_key",
        sync_source: nextStatus.sync_source || currentStatus.sync_source || DEFAULT_SYNC_STATUS.sync_source,
        sync_mode: nextStatus.sync_mode ?? currentStatus.sync_mode ?? DEFAULT_SYNC_STATUS.sync_mode,
    };

    await settingsRepo.updateSetting(MAINTENANCE_NORTH_SYNC_SETTING_ID, mergedStatus);
    return mergedStatus;
}

async function syncNorthReportsSnapshotToExternalStore(
    trigger: SyncTrigger = "manual",
    sourceOverride?: MaintenanceNorthSyncSource,
) {
    const startedAt = new Date().toISOString();
    const syncSource = resolveMaintenanceNorthSyncSource(sourceOverride);

    await writeMaintenanceNorthSyncStatus({
        status: "syncing",
        last_sync_at: startedAt,
        last_error: null,
        trigger,
        sync_source: syncSource,
    });

    try {
        const { rows: rawRows, mode, artifactPath } = loadNorthSyncRows(syncSource);
        const sourceSystem = resolveSourceSystem(syncSource);
        const normalizedRows = normalizeNorthReportRows(rawRows, {
            sourceSystem,
        });
        if (normalizedRows.length === 0) {
            throw new Error(`${syncSource} sync produced 0 rows; refusing to mark sync success`);
        }
        const existingRows = await externalTicketsRepo.listExternalTicketsByFallbackKeys(
            normalizedRows.map((row) => row.fallback_key),
            sourceSystem,
        );
        const mergedRows = mergeExternalTicketsForUpsert(normalizedRows, existingRows);
        const activeRowsBeforeSync = await externalTicketsRepo.listNorthActiveExternalTickets(sourceSystem);
        const syncedRows = await externalTicketsRepo.upsertExternalTickets(mergedRows);
        const activeFallbackKeys = new Set(normalizedRows.map((row) => row.fallback_key));
        const missingRows = activeRowsBeforeSync.filter((row) => !activeFallbackKeys.has(row.fallback_key));
        if (missingRows.length > 0) {
            await externalTicketsRepo.markExternalTicketsInactive(missingRows.map((row) => row.id));
        }
        const needsRefreshCount = await countNorthNeedsRefresh();
        const finishedAt = new Date().toISOString();

        const syncStatus = await writeMaintenanceNorthSyncStatus({
            status: "success",
            last_sync_at: finishedAt,
            last_success_at: finishedAt,
            last_error: null,
            trigger,
            synced_count: syncedRows.length,
            needs_refresh_count: needsRefreshCount,
            sync_source: syncSource,
            sync_mode: mode,
        });

        safeRevalidateMaintenance();

        return {
            syncedRows,
            syncStatus,
            artifactPath,
        };
    } catch (error) {
        const message = error instanceof Error
            ? error.message
            : (() => {
                try {
                    return JSON.stringify(error);
                } catch {
                    return String(error);
                }
            })();
        const failedStatus = await writeMaintenanceNorthSyncStatus({
            status: "failed",
            last_sync_at: new Date().toISOString(),
            last_error: message,
            trigger,
            sync_source: syncSource,
        });

        throw Object.assign(new Error(message), { syncStatus: failedStatus });
    }
}

async function readPendingNorthReportsFromExternalStore() {
    const supabase = createAdminClient();
    const { data: dbReports, error: reportError } = await supabase
        .from("maintenance_reports")
        .select("id, external_ticket_id, case_no, case_name, workflow_state")
        .order("created_at", { ascending: false });

    if (reportError) {
        throw reportError;
    }

    const syncSource = resolveMaintenanceNorthSyncSource();
    const sourceSystem = resolveSourceSystem(syncSource);
    const syncedTickets = await externalTicketsRepo.listNorthActiveExternalTickets(sourceSystem);

    return syncedTickets
        .map((ticket) => mapExternalTicketToPendingView(ticket, (dbReports || []) as BasicReportRow[]))
        .filter(Boolean) as PendingTicketView[];
}

function matchLatestReport(
    ticket: {
        id: string;
        source_case_no?: string | null;
        source_case_name?: string | null;
        case_no?: string | null;
        case_name?: string | null;
    },
    reports: BasicReportRow[],
) {
    const ticketCaseNo = ticket.case_no ?? ticket.source_case_no ?? null;
    const ticketCaseName = ticket.case_name ?? ticket.source_case_name ?? null;

    return reports.find((report) =>
        (report.external_ticket_id && report.external_ticket_id === ticket.id) ||
        (report.case_no && ticketCaseNo && report.case_no.trim() === ticketCaseNo.trim()) ||
        (report.case_name && ticketCaseName && report.case_name.trim() === ticketCaseName.trim()),
    );
}

function mapExternalTicketToPendingView(
    ticket: {
        id: string;
        fallback_key: string;
        source_region: string | null;
        source_case_name: string | null;
        source_case_no: string | null;
        source_report_time: string | null;
        source_reporter: string | null;
        source_issue_summary: string | null;
        source_report_issue: string | null;
        source_monitor_staff: string | null;
        source_monitor_judgement: string | null;
        source_monitor_note: string | null;
        source_repair_status: string | null;
        source_repair_staff: string | null;
        source_repair_note: string | null;
        source_work_date: string | null;
        source_complete_date: string | null;
        source_optimizer_count: number | null;
        source_system: string;
        conflict_status: string | null;
    },
    dbReports: BasicReportRow[],
): PendingTicketView | null {
    const latestReport = matchLatestReport(ticket, dbReports);

    if (latestReport?.workflow_state === "confirmed") {
        return null;
    }

    return {
        id: ticket.id,
        external_ticket_id: ticket.id,
        fallback_key: ticket.fallback_key,
        region: ticket.source_region || "",
        case_name: ticket.source_case_name || "",
        case_no: ticket.source_case_no || "",
        report_time: ticket.source_report_time || "",
        reporter: ticket.source_reporter || "",
        issue_summary: ticket.source_issue_summary || ticket.source_report_issue || "",
        monitor_staff: ticket.source_monitor_staff || "",
        monitor_judgement: ticket.source_monitor_judgement || "",
        repair_staff: ticket.source_repair_staff || "",
        external_note: [
            ticket.source_issue_summary || ticket.source_report_issue || "",
            ticket.source_monitor_note || "",
            ticket.source_repair_note || "",
        ].filter(Boolean).join("\n\n"),
        repair_status: ticket.source_repair_status || "待處理",
        work_date: ticket.source_work_date || "",
        complete_date: ticket.source_complete_date || "",
        workflow_state: latestReport?.workflow_state || null,
        optimizer_count: ticket.source_optimizer_count || null,
        conflict_status: ticket.conflict_status || null,
        source: ticket.source_system,
        source_of_truth: "external",
    };
}

async function linkExternalTicketToReport(externalTicketId: string | null | undefined, reportId: string) {
    if (!externalTicketId) {
        return;
    }

    const supabase = createAdminClient();
    await supabase
        .from("external_maintenance_tickets")
        .update({
            linked_maintenance_report_id: reportId,
            conflict_status: "clean",
            updated_at: new Date().toISOString(),
        } as never)
        .eq("id", externalTicketId);
}

export async function getMaintenanceNorthSyncStatusAction(): Promise<MaintenanceNorthSyncStatus> {
    try {
        const storedStatus =
            (await settingsRepo.getSetting<MaintenanceNorthSyncStatus>(MAINTENANCE_NORTH_SYNC_SETTING_ID)) ||
            DEFAULT_SYNC_STATUS;
        const needsRefreshCount = await countNorthNeedsRefresh().catch(() => storedStatus.needs_refresh_count || 0);

        return {
            ...storedStatus,
            needs_refresh_count: needsRefreshCount,
            source_of_truth: "external",
            identity_mode: "fallback_key",
            sync_source: resolveMaintenanceNorthSyncSource(),
            sync_mode: storedStatus.sync_mode ?? DEFAULT_SYNC_STATUS.sync_mode,
        };
    } catch {
        return DEFAULT_SYNC_STATUS;
    }
}

export async function syncMaintenanceNorthReportsAction(
    trigger: SyncTrigger = "manual",
    sourceOverride?: MaintenanceNorthSyncSource,
) {
    const { syncedRows, syncStatus, artifactPath } = await syncNorthReportsSnapshotToExternalStore(
        trigger,
        sourceOverride,
    );

    return {
        synced_count: syncedRows.length,
        sync_status: syncStatus,
        artifact_path: artifactPath,
    };
}

export async function listUnifiedContactsAction() {
    try {
        if (!fs.existsSync(NORTH_CONTACTS_PATH)) {
            console.warn(`[actions] Unified contacts file not found: ${NORTH_CONTACTS_PATH}`);
            return [];
        }

        return readProbeJson(NORTH_CONTACTS_PATH);
    } catch (error) {
        console.error("[actions] Failed to load unified contacts:", error);
        return [];
    }
}

export async function listMaintenanceTicketsAction(): Promise<MaintenanceTicket[]> {
    const supabase = createAdminClient();
    const { data, error } = await supabase
        .from("maintenance_tickets")
        .select("*")
        .order("created_at", { ascending: false });

    if (error) {
        throw error;
    }

    return data || [];
}

export async function listMaintenanceNorthReportsAction() {
    try {
        return await readPendingNorthReportsFromExternalStore();
    } catch (error) {
        console.error("[actions] Failed to read external_maintenance_tickets, falling back to snapshot:", error);

        await writeMaintenanceNorthSyncStatus({
            status: "failed",
            last_error: error instanceof Error ? error.message : "Failed to read external store",
            trigger: "read_fallback",
        }).catch(() => undefined);

        const syncSource = resolveMaintenanceNorthSyncSource();
        const sourceSystem = resolveSourceSystem(syncSource);
        const { rows: fallbackSourceRows } = loadNorthSyncRows(syncSource);
        const fallbackRows = normalizeNorthReportRows(fallbackSourceRows, { sourceSystem }).map((row) => ({
            id: row.fallback_key,
            external_ticket_id: row.fallback_key,
            fallback_key: row.fallback_key,
            source_region: row.source_region,
            source_case_name: row.source_case_name,
            source_case_no: row.source_case_no,
            source_report_time: row.source_report_time,
            source_reporter: row.source_reporter,
            source_issue_summary: row.source_issue_summary,
            source_report_issue: row.source_report_issue,
            source_monitor_staff: row.source_monitor_staff,
            source_monitor_judgement: row.source_monitor_judgement,
            source_monitor_note: row.source_monitor_note,
            source_repair_status: row.source_repair_status,
            source_repair_staff: row.source_repair_staff,
            source_repair_note: row.source_repair_note,
            source_work_date: row.source_work_date,
            source_complete_date: row.source_complete_date,
            source_optimizer_count: row.source_optimizer_count,
            source_system: row.source_system,
            conflict_status: "clean",
        }));

        return fallbackRows
            .map((ticket) => mapExternalTicketToPendingView(ticket, []))
            .filter(Boolean);
    }
}

export async function listMaintenanceReportsAction(): Promise<MaintenanceReport[]> {
    const supabase = createAdminClient();
    const { data, error } = await supabase
        .from("maintenance_reports")
        .select("*")
        .order("created_at", { ascending: false });

    if (error) {
        throw error;
    }

    return data || [];
}

export async function createMaintenanceReportAction(
    report: Omit<MaintenanceReport, "id" | "created_at" | "updated_at">,
) {
    const supabase = createAdminClient();
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(report.ticket_id || "");

    const cleanReport = {
        ...report,
        ticket_id: isUuid ? report.ticket_id : null,
        status: report.status || "待處理",
        workflow_state: report.workflow_state || "saved",
    };

    const { data, error } = await supabase
        .from("maintenance_reports")
        .insert(cleanReport)
        .select()
        .single();

    if (error) {
        console.error("[actions] createMaintenanceReportAction failed", error);
        throw new Error(`新增維運回報失敗: ${error.message} (${error.code})`);
    }

    if (report.ticket_id && isUuid) {
        await supabase
            .from("maintenance_tickets")
            .update({ status: "已處理" })
            .eq("id", report.ticket_id);
    }

    if (data?.id) {
        await linkExternalTicketToReport(report.external_ticket_id, data.id);
    }

    safeRevalidateMaintenance();
    return data;
}

export async function updateMaintenanceReportAction(id: string, updates: Partial<MaintenanceReport>) {
    const supabase = createAdminClient();
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(updates.ticket_id || "");

    const cleanUpdates: Partial<MaintenanceReport> = {
        ...updates,
        updated_at: new Date().toISOString(),
    };

    if (cleanUpdates.ticket_id !== undefined && !isUuid) {
        cleanUpdates.ticket_id = null;
    }

    const { data, error } = await supabase
        .from("maintenance_reports")
        .update(cleanUpdates)
        .eq("id", id)
        .select()
        .single();

    if (error) {
        console.error("[actions] updateMaintenanceReportAction failed", error);
        throw new Error(`更新維運回報失敗: ${error.message} (${error.code})`);
    }

    if (data?.id) {
        await linkExternalTicketToReport(cleanUpdates.external_ticket_id || data.external_ticket_id, data.id);
    }

    safeRevalidateMaintenance();
    return data;
}

export async function submitForReconciliationAction(reportId: string, updates?: Partial<MaintenanceReport>) {
    const supabase = createAdminClient();

    const reportUpdates = {
        ...(updates || {}),
        workflow_state: "pending_reconciliation",
        updated_at: new Date().toISOString(),
    };

    const { data: report, error: updateError } = await supabase
        .from("maintenance_reports")
        .update(reportUpdates)
        .eq("id", reportId)
        .select()
        .single();

    if (updateError) {
        throw updateError;
    }

    if (!report) {
        throw new Error("Report not found");
    }

    const metadata = report.metadata as { treatment_items?: Array<{ parts?: Array<Record<string, any>> }> } | null;
    if (!metadata?.treatment_items) {
        await supabase.from("maintenance_reports").update({ workflow_state: "confirmed" }).eq("id", reportId);
        safeRevalidateMaintenance();
        return report;
    }

    const recItems: Array<Record<string, any>> = [];
    const seItems: Array<Record<string, any>> = [];

    metadata.treatment_items.forEach((treatment, treatmentIndex) => {
        if (!treatment.parts) {
            return;
        }

        treatment.parts.forEach((part, partIndex) => {
            if (!part.qty || part.qty <= 0) {
                return;
            }

            const commonData = {
                report_id: reportId,
                case_name: report.case_name,
                case_no: report.case_no,
                report_date: report.completed_at
                    ? report.completed_at.split("T")[0]
                    : new Date().toISOString().split("T")[0],
                engineer_names: report.repair_staff,
                treatment_index: treatmentIndex,
                part_index: partIndex,
                item_id: part.item_id || null,
                item_name_snapshot: part.item_name || part.model_name || "未命名料件",
                source_bucket: part.source_bucket || "公司庫存",
                qty: part.qty,
                remark: part.remarks || "",
            };

            if (commonData.source_bucket === "公司庫存") {
                recItems.push({
                    ...commonData,
                    status: "pending",
                });
                return;
            }

            if (commonData.source_bucket === "SE備品") {
                seItems.push({
                    ...commonData,
                    old_model: part.old_model,
                    old_sn: part.old_sn,
                    new_sn: part.new_sn,
                    fault_reason: part.fault_reason || "",
                    receive_method: part.receive_method || "",
                    received_at: part.received_at || null,
                });
            }
        });
    });

    for (const seItem of seItems) {
        const { data: existing } = await supabase
            .from("se_inventory_tracking")
            .select("id")
            .or(`old_sn.eq.${seItem.old_sn},new_sn.eq.${seItem.new_sn}`)
            .limit(1);

        const existingRows = Array.isArray(existing) ? (existing as Array<{ id: string }>) : [];

        if (existingRows.length > 0) {
            await supabase
                .from("se_inventory_tracking")
                .update({
                    replacement_date: seItem.report_date,
                    case_name: seItem.case_name,
                    report_id: reportId,
                    fault_reason: seItem.fault_reason,
                    remarks: seItem.remark,
                    updated_at: new Date().toISOString(),
                } as never)
                .eq("id", existingRows[0].id);
            continue;
        }

        await supabase
            .from("se_inventory_tracking")
            .insert({
                case_name: seItem.case_name,
                old_model: seItem.old_model,
                old_sn: seItem.old_sn,
                new_sn: seItem.new_sn,
                fault_reason: seItem.fault_reason,
                receive_method: seItem.receive_method,
                received_at: seItem.received_at,
                replacement_date: seItem.report_date,
                remarks: seItem.remark,
                report_id: reportId,
            } as never);
    }

    if (recItems.length > 0) {
        await supabase.from("maintenance_reconciliation").delete().eq("report_id", reportId);
        const { error: recError } = await supabase.from("maintenance_reconciliation").insert(recItems as never[]);

        if (recError) {
            throw recError;
        }
    } else {
        await supabase
            .from("maintenance_reports")
            .update({
                workflow_state: "confirmed",
                reconciled_at: new Date().toISOString(),
            } as never)
            .eq("id", reportId);
    }

    safeRevalidateMaintenance();
    return report;
}

export async function listReconciliationPendingAction() {
    const supabase = createAdminClient();
    const { data, error } = await supabase
        .from("maintenance_reconciliation")
        .select("*")
        .eq("status", "pending")
        .order("report_date", { ascending: false });

    if (error) {
        throw error;
    }

    return data || [];
}

export async function confirmReconciliationAction(reconciliationId: string) {
    const supabase = createAdminClient();

    const { data: item, error: getError } = await supabase
        .from("maintenance_reconciliation")
        .select("*")
        .eq("id", reconciliationId)
        .single();

    if (getError || !item) {
        throw getError || new Error("Item not found");
    }

    const logEntry = {
        date: item.report_date || new Date().toISOString().split("T")[0],
        case_name: item.case_name,
        item_id: item.item_id,
        qty: item.qty,
        bucket: item.source_bucket,
        source_bucket: item.source_bucket,
        status: "已確認",
        report_id: item.report_id,
        reconciliation_id: item.id,
        treatment_index: item.treatment_index,
        part_index: item.part_index,
        item_name_snapshot: item.item_name_snapshot,
        remarks: item.remark,
    };

    const { error: logError } = await supabase.from("inventory_usage_logs").insert(logEntry as never);
    if (logError) {
        throw logError;
    }

    await supabase.from("maintenance_reconciliation").update({ status: "confirmed" }).eq("id", reconciliationId);

    const { data: remaining } = await supabase
        .from("maintenance_reconciliation")
        .select("id")
        .eq("report_id", item.report_id as string)
        .eq("status", "pending");

    if (!remaining || remaining.length === 0) {
        await supabase
            .from("maintenance_reports")
            .update({
                workflow_state: "confirmed",
                reconciled_at: new Date().toISOString(),
            } as never)
            .eq("id", item.report_id as string);
    }

    safeRevalidateMaintenance();
    revalidatePath("/inventory");
}

export async function returnReconciliationAction(reportId: string, reason: string) {
    const supabase = createAdminClient();

    await supabase
        .from("maintenance_reports")
        .update({
            workflow_state: "returned",
            returned_reason: reason,
            updated_at: new Date().toISOString(),
        } as never)
        .eq("id", reportId);

    await supabase
        .from("maintenance_reconciliation")
        .update({ status: "returned" })
        .eq("report_id", reportId)
        .eq("status", "pending");

    safeRevalidateMaintenance();
}

export async function listInventoryMasterAction(): Promise<any[]> {
    return inventoryRepo.getInventoryItems();
}

export async function getProjectByInfoAction(case_no?: string, case_name?: string) {
    const supabase = createAdminClient();

    if (case_no) {
        const { data } = await supabase.from("projects").select("*").eq("case_no", case_no).single();
        if (data) {
            return data;
        }
    }

    if (case_name) {
        const { data } = await supabase.from("projects").select("*").eq("name", case_name).single();
        if (data) {
            return data;
        }
    }

    return null;
}

export async function listProjectsMinimalAction() {
    const supabase = createAdminClient();
    const { data, error } = await supabase
        .from("projects")
        .select("id, name, case_no, address, site_contact_name, site_contact_phone");

    if (error) {
        throw error;
    }

    return data || [];
}
