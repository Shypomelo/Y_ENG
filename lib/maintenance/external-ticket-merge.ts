import { randomUUID } from "node:crypto";
import { Database } from "../types/database";
import { NormalizedExternalTicket } from "./external-ticket-normalizer";

type ExternalMaintenanceTicketRow = Database["public"]["Tables"]["external_maintenance_tickets"]["Row"];
type ExternalMaintenanceTicketInsert = Database["public"]["Tables"]["external_maintenance_tickets"]["Insert"];

export function mergeExternalTicketsForUpsert(
    normalizedRows: NormalizedExternalTicket[],
    existingRows: ExternalMaintenanceTicketRow[],
): ExternalMaintenanceTicketInsert[] {
    const now = new Date().toISOString();
    const existingByFallbackKey = new Map(existingRows.map((row) => [row.fallback_key, row]));

    return normalizedRows.map((row) => {
        const existing = existingByFallbackKey.get(row.fallback_key);
        const payloadChanged = !existing || existing.source_payload_hash !== row.source_payload_hash;
        const existingRuntimeMeta =
            existing?.source_runtime_meta && typeof existing.source_runtime_meta === "object" && !Array.isArray(existing.source_runtime_meta)
                ? existing.source_runtime_meta
                : {};
        const rowRuntimeMeta =
            row.source_runtime_meta && typeof row.source_runtime_meta === "object" && !Array.isArray(row.source_runtime_meta)
                ? row.source_runtime_meta
                : {};
        const nextConflictStatus = existing?.linked_maintenance_report_id && payloadChanged
            ? "needs_refresh"
            : existing?.conflict_status || "clean";

        const nextRow: ExternalMaintenanceTicketInsert = {
            id: existing?.id || randomUUID(),
            source_system: row.source_system,
            external_id: existing?.external_id || row.external_id,
            fallback_key: row.fallback_key,
            is_fallback_identity: row.is_fallback_identity,
            identity_confidence: existing?.external_id ? "external_id" : row.identity_confidence,
            source_region: row.source_region,
            source_case_no: row.source_case_no,
            source_case_name: row.source_case_name,
            source_report_time: row.source_report_time,
            source_reporter: row.source_reporter,
            source_report_issue: row.source_report_issue,
            source_issue_summary: row.source_issue_summary,
            source_monitor_staff: row.source_monitor_staff,
            source_monitor_judgement: row.source_monitor_judgement,
            source_monitor_note: row.source_monitor_note,
            source_repair_status: row.source_repair_status,
            source_repair_staff: row.source_repair_staff,
            source_repair_note: row.source_repair_note,
            source_work_date: row.source_work_date,
            source_complete_date: row.source_complete_date,
            source_optimizer_count: row.source_optimizer_count,
            source_payload: row.source_payload,
            source_payload_hash: row.source_payload_hash,
            source_row_html: row.source_row_html,
            source_dataset: row.source_dataset,
            source_runtime_meta: {
                ...existingRuntimeMeta,
                ...rowRuntimeMeta,
                fallback_key_active: true,
            },
            is_north: row.is_north,
            sync_status: "active",
            first_seen_at: existing?.first_seen_at || now,
            last_seen_at: now,
            last_synced_at: payloadChanged ? now : existing?.last_synced_at || now,
            last_source_updated_at: existing?.last_source_updated_at || null,
            linked_maintenance_report_id: existing?.linked_maintenance_report_id || null,
            linked_project_id: existing?.linked_project_id || null,
            writeback_eligible: false,
            writeback_status: existing?.writeback_status || "idle",
            writeback_candidate: existing?.writeback_candidate || null,
            writeback_last_checked_at: existing?.writeback_last_checked_at || null,
            writeback_last_attempt_at: existing?.writeback_last_attempt_at || null,
            writeback_last_success_at: existing?.writeback_last_success_at || null,
            writeback_error: existing?.writeback_error || null,
            conflict_status: nextConflictStatus,
            conflict_detail: payloadChanged
                ? {
                    reason: existing ? "source_payload_changed" : "first_ingest",
                    at: now,
                    identity_mode: existing?.external_id ? "external_id" : "fallback_key",
                }
                : existing?.conflict_detail || null,
            updated_at: now,
        };

        return nextRow;
    });
}
