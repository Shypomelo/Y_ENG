"use server";

import fs from "fs";
import path from "path";
import { createAdminClient } from "../../lib/supabase/admin";
import { MaintenanceTicket, MaintenanceReport } from "../../lib/types/database";
import * as inventoryRepo from "../../lib/repositories/inventory";
import { revalidatePath } from "next/cache";

const PROBE_OUTPUT_PATH = path.join(process.cwd(), 'maintenance-probe', 'probe-output', 'console', 'maintenance-reports.normalized.json');
const NORTH_REPORTS_PATH = path.join(process.cwd(), 'maintenance-probe', 'probe-output', 'console', 'north-reports.normalized.json');
const NORTH_CONTACTS_PATH = path.join(process.cwd(), 'maintenance-probe', 'probe-output', 'console', 'north-contacts.normalized.json');

export async function listUnifiedContactsAction() {
    try {
        if (!fs.existsSync(NORTH_CONTACTS_PATH)) {
            console.warn(`[actions] Unified contacts file not found: ${NORTH_CONTACTS_PATH}`);
            return [];
        }
        const rawJson = fs.readFileSync(NORTH_CONTACTS_PATH, 'utf8');
        const parsed = JSON.parse(rawJson);
        return parsed.data || [];
    } catch (error) {
        console.error("[actions] Failed to load unified contacts:", error);
        return [];
    }
}

export async function listMaintenanceTicketsAction(): Promise<MaintenanceTicket[]> {
    const supabase = createAdminClient();
    const { data, error } = await supabase
        .from('maintenance_tickets')
        .select('*')
        .order('created_at', { ascending: false });

    if (error) throw error;
    return data || [];
}

export async function listMaintenanceNorthReportsAction() {
    try {
        if (!fs.existsSync(NORTH_REPORTS_PATH)) {
            return [];
        }
        const rawJson = fs.readFileSync(NORTH_REPORTS_PATH, 'utf8');
        const parsed = JSON.parse(rawJson);
        const rawData = parsed.data || [];
        const supabase = createAdminClient();
        const { data: dbReports } = await supabase.from('maintenance_reports').select('id, case_no, case_name, status, workflow_state, metadata').order('created_at', { ascending: false });

        return rawData.map((row: any, index: number) => {
            const col0 = (row.region || '').split('\n');
            const col1 = (row.case_name || '').split('\n');
            const col2 = (row.case_no || '').split('\n');
            const col4 = (row.repair_status || row.reporter || '').split('\n');

            const cName = (col0[1] || '').trim();
            const cNo = (col0[2] || '').trim();

            const latestReport = dbReports?.find(r => 
                (r.case_no && r.case_no.trim() === cNo) || 
                (r.case_name && r.case_name.trim() === cName)
            );
            
            const currentStatus = latestReport?.status || (col4[0] || '').trim() || '待處理';
            
            // Workflow: If confirmed, remove from pending
            if (latestReport?.workflow_state === 'confirmed') {
                return null;
            }

            const monitorIssueDetail = col2.slice(1).join('\n').trim();
            const originalIssue = (col1[2] || '').trim();
            const finalIssueSummary = monitorIssueDetail || originalIssue || "";

            return {
                id: `north-${index}`,
                region: (col0[0] || '').trim(),
                case_name: cName,
                case_no: cNo,
                report_time: (col1[0] || '').trim(),
                reporter: (col1[1] || '').trim(),
                issue_summary: finalIssueSummary,
                repair_status: currentStatus,
                workflow_state: latestReport?.workflow_state || null,
                optimizer_count: row.optimizer_count || null,
                source: 'north-probe'
            };
        }).filter(Boolean);

    } catch (error) {
        console.error("[actions] Failed to load north reports:", error);
        return [];
    }
}

export async function listMaintenanceReportsAction(): Promise<MaintenanceReport[]> {
    const supabase = createAdminClient();
    const { data, error } = await supabase
        .from('maintenance_reports')
        .select('*')
        .order('created_at', { ascending: false });

    if (error) throw error;
    return data || [];
}

export async function createMaintenanceReportAction(report: Omit<MaintenanceReport, 'id' | 'created_at' | 'updated_at'>) {
    const supabase = createAdminClient();

    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(report.ticket_id || '');
    
    const cleanReport = { 
        ...report, 
        ticket_id: isUuid ? report.ticket_id : null,
        status: report.status || '待處理',
        workflow_state: report.workflow_state || 'saved',
    };

    const { data, error } = await supabase
        .from('maintenance_reports')
        .insert(cleanReport)
        .select()
        .single();

    if (error) {
        console.error("[actions] createMaintenanceReportAction failed");
        console.error("Table: maintenance_reports");
        console.error("原始錯誤:", error);
        throw new Error(`新增報表失敗: ${error.message} (${error.code})`);
    }

    if (report.ticket_id && isUuid) {
        await supabase
            .from('maintenance_tickets')
            .update({ status: '已回報' })
            .eq('id', report.ticket_id);
    }

    revalidatePath("/maintenance");
    return data;
}

export async function updateMaintenanceReportAction(id: string, updates: Partial<MaintenanceReport>) {
    const supabase = createAdminClient();

    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(updates.ticket_id || '');
    
    const cleanUpdates = { 
        ...updates, 
        updated_at: new Date().toISOString() 
    };
    if (cleanUpdates.ticket_id !== undefined && !isUuid) {
        cleanUpdates.ticket_id = null;
    }

    const { data, error } = await supabase
        .from('maintenance_reports')
        .update(cleanUpdates)
        .eq('id', id)
        .select()
        .single();

    if (error) {
        console.error("[actions] updateMaintenanceReportAction failed");
        console.error("Table: maintenance_reports");
        console.error("ID:", id);
        console.error("原始錯誤:", error);
        throw new Error(`更新報表失敗: ${error.message} (${error.code})`);
    }
    revalidatePath("/maintenance");
    return data;
}

export async function submitForReconciliationAction(reportId: string, updates?: Partial<MaintenanceReport>) {
    const supabase = createAdminClient();
    
    // 1. Update report state
    const reportUpdates = {
        ...(updates || {}),
        workflow_state: 'pending_reconciliation',
        updated_at: new Date().toISOString()
    };
    
    const { data: report, error: updateError } = await supabase
        .from('maintenance_reports')
        .update(reportUpdates)
        .eq('id', reportId)
        .select()
        .single();
        
    if (updateError) throw updateError;
    if (!report) throw new Error("Report not found");

    // 2. Prepare reconciliation items from metadata
    const metadata = report.metadata as any;
    if (!metadata || !metadata.treatment_items) {
        await supabase.from('maintenance_reports').update({ workflow_state: 'confirmed' }).eq('id', reportId);
        revalidatePath("/maintenance");
        return report;
    }

    const recItems: any[] = [];
    const seItems: any[] = [];
    const treatmentItems = metadata.treatment_items as any[];
    
    treatmentItems.forEach((treatment, tIdx) => {
        if (!treatment.parts) return;
        treatment.parts.forEach((part: any, pIdx: number) => {
            if (!part.qty || part.qty <= 0) return;
            
            const commonData = {
                report_id: reportId,
                case_name: report.case_name,
                case_no: report.case_no,
                report_date: report.completed_at ? report.completed_at.split('T')[0] : new Date().toISOString().split('T')[0],
                engineer_names: report.repair_staff,
                treatment_index: tIdx,
                part_index: pIdx,
                item_id: part.item_id || null,
                item_name_snapshot: part.item_name || part.model_name || '未知品項',
                source_bucket: part.source_bucket || '陽光庫存',
                qty: part.qty,
                remark: part.remarks || '',
            };

            if (commonData.source_bucket === '陽光庫存') {
                recItems.push({
                    ...commonData,
                    status: 'pending'
                });
            } else if (commonData.source_bucket === 'SE提供') {
                seItems.push({
                    ...commonData,
                    old_model: part.old_model,
                    old_sn: part.old_sn,
                    new_sn: part.new_sn,
                    fault_reason: part.fault_reason || '',
                    receive_method: part.receive_method || '',
                    received_at: part.received_at || null,
                });
            }
        });
    });

    // 3. Handle SE Items (Direct Update/Sync)
    for (const seItem of seItems) {
        // Try to update existing record by S/N if possible, otherwise just track it
        const { data: existing } = await supabase
            .from('se_inventory_tracking')
            .select('id')
            .or(`old_sn.eq.${seItem.old_sn},new_sn.eq.${seItem.new_sn}`)
            .limit(1);

        if (existing && existing.length > 0) {
            await supabase
                .from('se_inventory_tracking')
                .update({
                    replacement_date: seItem.report_date,
                    case_name: seItem.case_name,
                    report_id: reportId,
                    fault_reason: seItem.fault_reason,
                    remarks: seItem.remark,
                    updated_at: new Date().toISOString()
                } as any)
                .eq('id', (existing[0] as any).id);
        } else {
            // If no master record exists yet, create one for tracking the replacement
            await supabase
                .from('se_inventory_tracking')
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
                    report_id: reportId
                } as any);
        }
    }

    // 4. Handle Reconciliation Table (Sunshine Only)
    if (recItems.length > 0) {
        await supabase.from('maintenance_reconciliation').delete().eq('report_id', reportId);
        const { error: recError } = await supabase.from('maintenance_reconciliation').insert(recItems);
        if (recError) {
            console.error("[actions] submitForReconciliationAction failed to insert recItems");
            console.error("Table: maintenance_reconciliation");
            console.error("原始錯誤:", recError);
            throw recError;
        }
    } else {
        // If no sunshine items, this report is effectively confirmed for inventory purposes
        await supabase.from('maintenance_reports').update({ 
            workflow_state: 'confirmed',
            reconciled_at: new Date().toISOString()
        } as any).eq('id', reportId);
    }

    revalidatePath("/maintenance");
    return report;
}

export async function listReconciliationPendingAction() {
    const supabase = createAdminClient();
    const { data, error } = await supabase
        .from('maintenance_reconciliation')
        .select('*')
        .eq('status', 'pending')
        .order('report_date', { ascending: false });
    if (error) throw error;
    return data || [];
}

export async function confirmReconciliationAction(reconciliationId: string) {
    const supabase = createAdminClient();
    
    const { data: item, error: getError } = await supabase
        .from('maintenance_reconciliation')
        .select('*')
        .eq('id', reconciliationId)
        .single();
    if (getError || !item) throw getError || new Error("Item not found");

    const logEntry = {
        date: item.report_date || new Date().toISOString().split('T')[0],
        case_name: item.case_name,
        item_id: item.item_id,
        qty: item.qty,
        bucket: item.source_bucket,
        source_bucket: item.source_bucket,
        status: '已確認',
        report_id: item.report_id,
        reconciliation_id: item.id,
        treatment_index: item.treatment_index,
        part_index: item.part_index,
        item_name_snapshot: item.item_name_snapshot,
        remarks: item.remark
    };

    const { error: logError } = await supabase.from('inventory_usage_logs').insert(logEntry as any);
    if (logError) throw logError;

    await supabase.from('maintenance_reconciliation').update({ status: 'confirmed' }).eq('id', reconciliationId);

    const { data: remaining } = await supabase
        .from('maintenance_reconciliation')
        .select('id')
        .eq('report_id', item.report_id as string)
        .eq('status', 'pending');
    
    if (!remaining || remaining.length === 0) {
        await supabase
            .from('maintenance_reports')
            .update({ 
                workflow_state: 'confirmed',
                reconciled_at: new Date().toISOString()
            } as any)
            .eq('id', item.report_id as string);
    }

    revalidatePath("/maintenance");
    revalidatePath("/inventory");
}

export async function returnReconciliationAction(reportId: string, reason: string) {
    const supabase = createAdminClient();
    
    await supabase.from('maintenance_reports').update({
        workflow_state: 'returned',
        returned_reason: reason,
        updated_at: new Date().toISOString()
    } as any).eq('id', reportId);

    await supabase.from('maintenance_reconciliation').update({ status: 'returned' }).eq('report_id', reportId).eq('status', 'pending');

    revalidatePath("/maintenance");
}

export async function listInventoryMasterAction(): Promise<any[]> {
    return await inventoryRepo.getInventoryItems();
}

export async function getProjectByInfoAction(case_no?: string, case_name?: string) {
    const supabase = createAdminClient();
    if (case_no) {
        const { data } = await supabase.from('projects').select('*').eq('case_no', case_no).single();
        if (data) return data;
    }
    if (case_name) {
        const { data } = await supabase.from('projects').select('*').eq('name', case_name).single();
        if (data) return data;
    }
    return null;
}

export async function listProjectsMinimalAction() {
    const supabase = createAdminClient();
    const { data, error } = await supabase
        .from('projects')
        .select('id, name, case_no, address, site_contact_name, site_contact_phone');
    if (error) throw error;
    return data || [];
}
