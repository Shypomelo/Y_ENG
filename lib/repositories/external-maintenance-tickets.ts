"use server";

import { createAdminClient } from "../supabase/admin";
import { Database } from "../types/database";

type ExternalMaintenanceTicketRow = Database["public"]["Tables"]["external_maintenance_tickets"]["Row"];
type ExternalMaintenanceTicketInsert = Database["public"]["Tables"]["external_maintenance_tickets"]["Insert"];

export async function listExternalTicketsByFallbackKeys(
    fallbackKeys: string[],
    sourceSystem?: string,
): Promise<ExternalMaintenanceTicketRow[]> {
    if (fallbackKeys.length === 0) return [];

    const supabase = createAdminClient();
    let query = supabase
        .from("external_maintenance_tickets")
        .select("*")
        .in("fallback_key", fallbackKeys);

    if (sourceSystem) {
        query = query.eq("source_system", sourceSystem);
    }

    const { data, error } = await query;
    if (error) throw error;
    return data || [];
}

export async function upsertExternalTickets(rows: ExternalMaintenanceTicketInsert[]) {
    if (rows.length === 0) return [];

    const supabase = createAdminClient();
    const { data, error } = await supabase
        .from("external_maintenance_tickets")
        .upsert(rows, {
            onConflict: "source_system,fallback_key",
        })
        .select("*");

    if (error) throw error;
    return data || [];
}

export async function listNorthActiveExternalTickets(sourceSystem?: string): Promise<ExternalMaintenanceTicketRow[]> {
    const supabase = createAdminClient();
    let query = supabase
        .from("external_maintenance_tickets")
        .select("*")
        .eq("is_north", true)
        .eq("sync_status", "active")
        .order("source_report_time", { ascending: false, nullsFirst: false })
        .order("created_at", { ascending: false });

    if (sourceSystem) {
        query = query.eq("source_system", sourceSystem);
    }

    const { data, error } = await query;
    if (error) throw error;
    return data || [];
}

export async function markExternalTicketsInactive(ticketIds: string[]) {
    if (ticketIds.length === 0) return [];

    const supabase = createAdminClient();
    const now = new Date().toISOString();
    const { data, error } = await supabase
        .from("external_maintenance_tickets")
        .update({
            sync_status: "missing_from_source",
            updated_at: now,
        })
        .in("id", ticketIds)
        .select("*");

    if (error) throw error;
    return data || [];
}
