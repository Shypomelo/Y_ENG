"use server";

import * as inventoryRepo from "../../lib/repositories/inventory";
import { createAdminClient } from "../../lib/supabase/admin";
import { revalidatePath } from "next/cache";

export async function getInventorySummaryAction(month: string, bucket: string = '陽光庫存') {
    try {
        return await inventoryRepo.getInventorySummary(month, bucket);
    } catch (error: any) {
        console.error(`[actions] getInventorySummaryAction failed for ${month}, bucket: ${bucket}`);
        const errorDetails = {
            code: error?.code,
            message: error?.message,
            details: error?.details,
            hint: error?.hint,
            stack: error?.stack
        };
        console.error("Original Error:", errorDetails);
        // During debugging, return error as object to see in UI if possible, or still return empty list but with error info
        return { error: true, ...errorDetails } as any;
    }
}

export async function isMonthArchivedAction(month: string) {
    try {
        return await inventoryRepo.isMonthArchived(month);
    } catch (error: any) {
        console.error(`[actions] isMonthArchivedAction failed for ${month}:`, error);
        return false;
    }
}

export async function getMonthlyUsageLogsAction(month: string, bucket: string = '陽光庫存') {
    try {
        return await inventoryRepo.getMonthlyUsageLogs(month, bucket);
    } catch (error: any) {
        console.error(`[actions] getMonthlyUsageLogsAction failed for ${month}, bucket: ${bucket}`);
        console.error("Original Error:", {
            code: error?.code,
            message: error?.message,
            details: error?.details,
            hint: error?.hint,
            stack: error?.stack
        });
        return [];
    }
}

export async function addInboundLogAction(log: Omit<inventoryRepo.InboundLog, 'id' | 'created_at'>) {
    const month = log.date.substring(0, 7);
    if (await inventoryRepo.isMonthArchived(month)) {
        throw new Error("該月份已封存，不可再新增入庫紀錄。");
    }
    const res = await inventoryRepo.addInboundLog(log);
    revalidatePath("/inventory");
    return res;
}

export async function createItemAndInboundAction(
    item: Partial<inventoryRepo.InventoryItem>, 
    inbound: { date: string; qty: number; remarks: string }
) {
    const newItem = await inventoryRepo.upsertInventoryItem(item);
    const log = await inventoryRepo.addInboundLog({
        item_id: newItem.id,
        date: inbound.date,
        qty: inbound.qty,
        remarks: inbound.remarks
    });
    revalidatePath("/inventory");
    return { item: newItem, log };
}

export async function upsertUsageLogAction(log: Partial<inventoryRepo.UsageLog>) {
    if (log.date) {
        const month = log.date.substring(0, 7);
        if (await inventoryRepo.isMonthArchived(month)) {
            throw new Error("該月份已封存，不可修改使用明細。");
        }
    }
    const res = await inventoryRepo.upsertUsageLog(log);
    revalidatePath("/inventory");
    return res;
}

export async function deleteUsageLogAction(id: string) {
    const supabase = createAdminClient();
    const { data: log } = await supabase.from('inventory_usage_logs').select('date').eq('id', id).single();
    if (log) {
        const month = (log as any).date.substring(0, 7);
        if (await inventoryRepo.isMonthArchived(month)) {
            throw new Error("該月份已封存，不可刪除使用明細。");
        }
    }
    await inventoryRepo.deleteUsageLog(id);
    revalidatePath("/inventory");
}

export async function confirmUsageAction(id: string) {
    const supabase = createAdminClient();
    const { data: log } = await supabase.from('inventory_usage_logs').select('date').eq('id', id).single();
    if (log) {
        const month = (log as any).date.substring(0, 7);
        if (await inventoryRepo.isMonthArchived(month)) {
            throw new Error("該月份已封存，不可變更狀態。");
        }
    }
    await inventoryRepo.upsertUsageLog({ id, status: '已確認' });
    revalidatePath("/inventory");
}

export async function archiveMonthAction(month: string) {
    await inventoryRepo.archiveInventory(month);
    revalidatePath("/inventory");
}

// NEW Reconciliation Actions (Bridged from Maintenance logic)
export async function getPendingReconciliationAction() {
    try {
        const supabase = createAdminClient();
        const { data, error } = await supabase
            .from('maintenance_reconciliation')
            .select('*')
            .eq('status', 'pending')
            .order('report_date', { ascending: false });
        if (error) {
            console.error("[actions] getPendingReconciliationAction failed");
            console.error("Table: maintenance_reconciliation");
            console.error("原始錯誤:", error);
            throw error;
        }
        return data || [];
    } catch (error: any) {
        console.error("[actions] getPendingReconciliationAction Exception:", error);
        throw error;
    }
}

export async function confirmReconciliationItemAction(reconciliationId: string) {
    const supabase = createAdminClient();
    
    // 1. Get reconciliation item
    const { data: item, error: getError } = await supabase
        .from('maintenance_reconciliation')
        .select('*')
        .eq('id', reconciliationId)
        .single();
    if (getError || !item) throw getError || new Error("Item not found");

    // 2. Write to inventory usage logs
    const logEntry = {
        date: item.report_date,
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

    // 3. Mark reconciliation as confirmed
    await supabase.from('maintenance_reconciliation').update({ status: 'confirmed' }).eq('id', reconciliationId);

    // 4. Check if report is fully finished
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

    revalidatePath("/inventory");
    revalidatePath("/maintenance");
}

export async function softDeleteItemAction(id: string) {
    await inventoryRepo.softDeleteItem(id);
    revalidatePath('/inventory');
}

export async function restoreItemAction(id: string) {
    await inventoryRepo.restoreItem(id);
    revalidatePath('/inventory');
}

export async function updateItemRemarksAction(id: string, remarks: string) {
    await inventoryRepo.updateItemRemarks(id, remarks);
    revalidatePath('/inventory');
}

export async function createInventoryItemAction(item: Partial<inventoryRepo.InventoryItem>) {
    const res = await inventoryRepo.upsertInventoryItem(item);
    revalidatePath('/inventory');
    return res;
}

export async function updateInventoryItemAction(id: string, item: Partial<inventoryRepo.InventoryItem>) {
    const res = await inventoryRepo.upsertInventoryItem({ ...item, id });
    revalidatePath('/inventory');
    return res;
}

export async function addAdjustmentLogAction(log: Omit<inventoryRepo.AdjustmentLog, 'id' | 'created_at'>) {
    const month = log.date.substring(0, 7);
    if (await inventoryRepo.isMonthArchived(month)) {
        throw new Error("該月份已封存，不可再新增調整紀錄。");
    }
    const res = await inventoryRepo.addAdjustmentLog(log);
    revalidatePath("/inventory");
    return res;
}

export async function getItemLogsAction(itemId: string) {
    return await inventoryRepo.getItemLogs(itemId);
}

export async function getDeletedInventoryItemsAction() {
    return await inventoryRepo.getInventoryItems(true).then(items => items.filter(i => i.is_deleted));
}

export async function getInventoryItemsAction() {
    return await inventoryRepo.getInventoryItems();
}

export async function exportInventoryCSVAction(month: string) {
    const summary = await inventoryRepo.getInventorySummary(month);
    let csv = "品項/型號,分類,期初庫存,本月入庫,本月出庫,本月結餘,備註\n";
    for (const s of (summary as any[])) {
        csv += `${s.name},${s.category},${s.opening_qty},${s.inbound_qty},${s.outbound_qty},${s.closing_qty},${s.remarks || ''}\n`;
    }
    return csv;
}

export async function exportUsageCSVAction(month: string) {
    const logs = await inventoryRepo.getMonthlyUsageLogs(month);
    let csv = "日期,案場名稱,使用品項,數量,來源庫別,狀態,備註\n";
    for (const l of (logs as any[])) {
        csv += `${l.date},${l.case_name || ''},${l.item?.name || l.item_name_snapshot || ''},${l.qty},${l.bucket},${l.status},${l.remarks || ''}\n`;
    }
    return csv;
}

export async function getSETrackingAction() {
    try {
        const supabase = createAdminClient();
        const { data, error } = await supabase
            .from('se_inventory_tracking')
            .select('*')
            .order('replacement_date', { ascending: false, nullsFirst: true })
            .order('created_at', { ascending: false });
        
        if (error) {
            // 42P01 is "relation does not exist" - the table is missing
            if (error.code === '42P01') {
                console.warn("[actions] SE tracking table missing. Returning empty.");
                return [];
            }
            console.error("[actions] getSETrackingAction failed");
            console.error("原始錯誤:", error);
            revalidatePath("/inventory");
        }
        return data || [];
    } catch (error) {
        console.error("[actions] getSETrackingAction failed:", error);
        return []; // Fail gracefully for UI
    }
}

export async function createSETrackingAction(data: any) {
    const supabase = createAdminClient();
    const { data: result, error } = await supabase
        .from('se_inventory_tracking')
        .insert([data])
        .select()
        .single();

    if (error) {
        console.error("[actions] createSETrackingAction failed:", error);
        throw error;
    }
    revalidatePath("/inventory");
    return result;
}

export async function updateSETrackingAction(id: string, data: any) {
    const supabase = createAdminClient();
    const { data: result, error } = await supabase
        .from('se_inventory_tracking')
        .update(data)
        .eq('id', id)
        .select()
        .single();

    if (error) {
        console.error("[actions] updateSETrackingAction failed:", error);
        throw error;
    }
    revalidatePath("/inventory");
    return result;
}

export async function deleteSETrackingAction(id: string) {
    const supabase = createAdminClient();
    const { error } = await supabase.from('se_inventory_tracking').delete().eq('id', id);
    if (error) throw error;
    revalidatePath("/inventory");
}

export async function upsertSETrackingAction(tracking: any) {
    const supabase = createAdminClient();
    const { data, error } = await supabase
        .from('se_inventory_tracking')
        .upsert({
            ...tracking,
            updated_at: new Date().toISOString()
        })
        .select()
        .single();
    if (error) throw error;
    revalidatePath("/inventory");
    return data;
}
