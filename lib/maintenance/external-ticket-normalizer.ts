import { createHash } from "node:crypto";
import { Json } from "../types/database";

const SOURCE_SYSTEM = "solargarden_report_crud";
const FIRESTORE_READONLY_SOURCE_SYSTEM = "solargarden_firestore_readonly_browser_list";

type RawNorthReportRow = {
    region?: string;
    case_name?: string;
    case_no?: string;
    report_time?: string;
    reporter?: string;
    report_issue?: string;
    monitor_staff?: string;
    monitor_judgement?: string;
    monitor_note?: string;
    repair_staff?: string;
    repair_note?: string;
    repair_status?: string;
    work_date?: string;
    complete_date?: string;
    optimizer_count?: number | null;
    cell_case?: string;
    cell_report?: string;
    cell_monitor?: string;
    cell_repair?: string;
    cell_status?: string;
};

export type NormalizedExternalTicket = {
    source_system: string;
    external_id: null;
    fallback_key: string;
    is_fallback_identity: true;
    identity_confidence: "fallback_strong" | "fallback_weak";
    source_region: string | null;
    source_case_no: string | null;
    source_case_name: string | null;
    source_report_time: string | null;
    source_reporter: string | null;
    source_report_issue: string | null;
    source_issue_summary: string | null;
    source_monitor_staff: string | null;
    source_monitor_judgement: string | null;
    source_monitor_note: string | null;
    source_repair_status: string | null;
    source_repair_staff: string | null;
    source_repair_note: string | null;
    source_work_date: string | null;
    source_complete_date: string | null;
    source_optimizer_count: number | null;
    source_payload: Json;
    source_payload_hash: string;
    source_row_html: null;
    source_dataset: null;
    source_runtime_meta: Json;
    is_north: boolean;
    sync_status: "active";
};

type NormalizeNorthReportOptions = {
    sourceSystem?: string;
};

function collapseWhitespace(value: string | null | undefined) {
    return (value || "").replace(/\s+/g, " ").trim();
}

function normalizeIdentityPart(value: string | null | undefined) {
    return collapseWhitespace(value).toLowerCase();
}

function mergeUniqueLines(values: Array<string | null | undefined>) {
    const result: string[] = [];
    for (const value of values) {
        const normalized = collapseWhitespace(value);
        if (!normalized) continue;
        if (!result.includes(normalized)) {
            result.push(normalized);
        }
    }
    return result.join("\n") || null;
}

function hashText(value: string | null | undefined) {
    return createHash("sha256").update(collapseWhitespace(value), "utf8").digest("hex");
}

function parseDateTime(value: string | null | undefined) {
    const trimmed = collapseWhitespace(value);
    if (!trimmed || trimmed === "---") {
        return null;
    }

    const match = trimmed.match(/^(\d{4})\/(\d{1,2})\/(\d{1,2})(?:\s+(\d{1,2}):(\d{2}))?$/);
    if (!match) {
        return null;
    }

    const [, year, month, day, hour = "00", minute = "00"] = match;
    return `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}T${hour.padStart(2, "0")}:${minute}:00+08:00`;
}

function parseDateOnly(value: string | null | undefined) {
    const trimmed = collapseWhitespace(value);
    if (!trimmed || trimmed === "---") {
        return null;
    }

    const match = trimmed.match(/^(\d{4})[/-](\d{1,2})[/-](\d{1,2})$/);
    if (!match) {
        return null;
    }

    const [, year, month, day] = match;
    return `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
}

function buildFallbackKey(input: {
    region: string | null;
    caseName: string | null;
    caseNo: string | null;
    reportTime: string | null;
    reportIssue: string | null;
    sourceSystem: string;
}) {
    return [
        input.sourceSystem,
        normalizeIdentityPart(input.region),
        normalizeIdentityPart(input.caseName),
        normalizeIdentityPart(input.caseNo),
        normalizeIdentityPart(input.reportTime),
        hashText(input.reportIssue),
    ].join(":");
}

export function normalizeNorthReportRow(
    rawRow: RawNorthReportRow,
    options: NormalizeNorthReportOptions = {},
): NormalizedExternalTicket {
    const sourceSystem = options.sourceSystem || SOURCE_SYSTEM;
    const regionParts = String(rawRow.cell_case || rawRow.region || "").split("\n");
    const reportMetaParts = String(rawRow.cell_report || rawRow.case_name || "").split("\n");
    const monitorParts = String(rawRow.cell_monitor || rawRow.case_no || "").split("\n");
    const repairParts = String(rawRow.cell_repair || rawRow.report_time || rawRow.repair_staff || "").split("\n");
    const statusParts = String(rawRow.cell_status || rawRow.reporter || rawRow.repair_status || "").split("\n");

    const sourceRegion = collapseWhitespace(regionParts[0]);
    const sourceCaseName = collapseWhitespace(regionParts[1]);
    const sourceCaseNo = collapseWhitespace(regionParts[2]);
    const reportTimeRaw = collapseWhitespace(reportMetaParts[0]);
    const sourceReporter = collapseWhitespace(reportMetaParts[1]);
    const originalIssue = collapseWhitespace(rawRow.report_issue || reportMetaParts[2]);
    const detailedIssue = monitorParts.slice(2).map(collapseWhitespace).filter(Boolean).join("\n");
    const sourceReportIssue = originalIssue || detailedIssue || null;
    const sourceIssueSummary = detailedIssue || originalIssue || null;
    const sourceRepairStatus = collapseWhitespace(statusParts[0]) || null;
    const sourceRepairStaff = collapseWhitespace(rawRow.repair_staff || repairParts[0]) || null;
    const sourceRepairNote = mergeUniqueLines([rawRow.repair_note, ...repairParts.slice(1)]);
    const sourceMonitorStaff = collapseWhitespace(rawRow.monitor_staff || monitorParts[0]) || null;
    const sourceMonitorJudgement = collapseWhitespace(rawRow.monitor_judgement || monitorParts[1]) || null;
    const sourceMonitorNote = mergeUniqueLines([rawRow.monitor_note, ...monitorParts.slice(2)]);
    const sourceWorkDate = parseDateOnly(rawRow.work_date || statusParts[1]);
    const sourceCompleteDate = parseDateOnly(rawRow.complete_date || statusParts[2]);
    const sourceReportTime = parseDateTime(reportTimeRaw);

    const sourcePayload: Json = {
        raw: rawRow,
        parsed: {
            source_region: sourceRegion || null,
            source_case_name: sourceCaseName || null,
            source_case_no: sourceCaseNo || null,
            source_report_time_raw: reportTimeRaw || null,
            source_reporter: sourceReporter || null,
            source_report_issue: sourceReportIssue,
            source_issue_summary: sourceIssueSummary,
            source_repair_status: sourceRepairStatus,
            source_work_date: sourceWorkDate,
            source_complete_date: sourceCompleteDate,
        },
    };

    const fallbackKey = buildFallbackKey({
        region: sourceRegion || null,
        caseName: sourceCaseName || null,
        caseNo: sourceCaseNo || null,
        reportTime: reportTimeRaw || null,
        reportIssue: sourceReportIssue,
        sourceSystem,
    });

    const strongIdentity = Boolean(sourceRegion && sourceCaseName && sourceCaseNo && reportTimeRaw);

    return {
        source_system: sourceSystem,
        external_id: null,
        fallback_key: fallbackKey,
        is_fallback_identity: true,
        identity_confidence: strongIdentity ? "fallback_strong" : "fallback_weak",
        source_region: sourceRegion || null,
        source_case_no: sourceCaseNo || null,
        source_case_name: sourceCaseName || null,
        source_report_time: sourceReportTime,
        source_reporter: sourceReporter || null,
        source_report_issue: sourceReportIssue,
        source_issue_summary: sourceIssueSummary,
        source_monitor_staff: sourceMonitorStaff,
        source_monitor_judgement: sourceMonitorJudgement,
        source_monitor_note: sourceMonitorNote,
        source_repair_status: sourceRepairStatus,
        source_repair_staff: sourceRepairStaff,
        source_repair_note: sourceRepairNote,
        source_work_date: sourceWorkDate,
        source_complete_date: sourceCompleteDate,
        source_optimizer_count: typeof rawRow.optimizer_count === "number" ? rawRow.optimizer_count : null,
        source_payload: sourcePayload,
        source_payload_hash: hashText(JSON.stringify(sourcePayload)),
        source_row_html: null,
        source_dataset: null,
        source_runtime_meta: {
            identity_strategy: "fallback_key",
            stable_external_id_verified: false,
        } as Json,
        is_north: sourceRegion.includes("\u5317\u5340"),
        sync_status: "active",
    };
}

export function normalizeNorthReportRows(
    rawRows: RawNorthReportRow[],
    options: NormalizeNorthReportOptions = {},
) {
    return rawRows.map((row) => normalizeNorthReportRow(row, options));
}

export { FIRESTORE_READONLY_SOURCE_SYSTEM, SOURCE_SYSTEM };
