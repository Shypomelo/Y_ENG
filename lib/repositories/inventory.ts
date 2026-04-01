import { createAdminClient } from "../supabase/admin";

export type InventoryItem = {
    id: string;
    name: string;
    category: string;
    bucket: string;
    is_active: boolean;
    is_deleted: boolean;
    sort_order: number;
    remarks: string;
    created_at: string;
    updated_at: string;
};

export type InboundLog = {
    id: string;
    item_id: string;
    date: string;
    qty: number;
    remarks: string;
    created_at: string;
};
export type UsageLog = {
    id: string;
    date: string;
    case_name: string;
    item_id: string;
    qty: number;
    bucket: string;
    status: string;
    report_id: string;
    remarks: string;
    created_at: string;
    treatment_name?: string;
    treatment_index?: number;
    part_index?: number;
};

export type AdjustmentLog = {
    id: string;
    item_id: string;
    date: string;
    qty: number;
    reason: string;
    remarks: string;
    created_at: string;
};

export async function getInventoryItems(includeDeleted: boolean = false) {
    const supabase = createAdminClient();
    let query = supabase
        .from('inventory_items')
        .select('*')
        .order('sort_order', { ascending: true });

    // Use is_active as fallback if is_deleted doesn't exist
    // However, we first try the standard query
    const { data: initialData, error: initialError } = await query;

    if (initialError && (initialError as any).code === '42703') {
        console.warn("[inventory] is_deleted column missing, falling back to is_active logic...");
        const { data: fallbackData, error: fallbackError } = await supabase
            .from('inventory_items')
            .select('id, name, category, bucket, is_active, sort_order, remarks, created_at, updated_at')
            .order('sort_order', { ascending: true });

        if (fallbackError) throw fallbackError;

        let filtered = fallbackData || [];
        if (!includeDeleted) {
            filtered = filtered.filter(i => (i as any).is_active !== false);
        }
        return filtered.map(i => ({ ...i, is_deleted: false })) as any[];
    }

    if (initialError) {
        console.error("[repo] getInventoryItems initial query failed");
        console.error("Table: inventory_items");
        console.error("原始錯誤:", initialError);
        throw initialError;
    }

    let results = initialData || [];
    if (!includeDeleted) {
        results = results.filter(i => {
            const row = i as any;
            // If is_deleted exists, respect it. If not, fallback to is_active or assume visible.
            if (row.is_deleted !== undefined) return row.is_deleted === false;
            if (row.is_active !== undefined) return row.is_active !== false;
            return true;
        });
    }
    return results.map(i => ({ ...i, is_deleted: (i as any).is_deleted ?? false })) as InventoryItem[];
}

export async function upsertInventoryItem(item: Partial<InventoryItem>) {
    const supabase = createAdminClient();
    const { data, error } = await supabase
        .from('inventory_items')
        .upsert({ ...item, updated_at: new Date().toISOString() } as any)
        .select()
        .single();
    if (error) throw error;
    return data as InventoryItem;
}

export async function softDeleteItem(id: string) {
    const supabase = createAdminClient();
    // Try is_deleted first, fallback to is_active
    const { error } = await supabase
        .from('inventory_items')
        .update({ is_deleted: true, updated_at: new Date().toISOString() } as any)
        .eq('id', id);

    if (error && (error as any).code === '42703') {
        await supabase
            .from('inventory_items')
            .update({ is_active: false, updated_at: new Date().toISOString() } as any)
            .eq('id', id);
        return;
    }
    if (error) throw error;
}

export async function restoreItem(id: string) {
    const supabase = createAdminClient();
    const { error } = await supabase
        .from('inventory_items')
        .update({ is_deleted: false, is_active: true, updated_at: new Date().toISOString() } as any)
        .eq('id', id);

    if (error && (error as any).code === '42703') {
        await supabase
            .from('inventory_items')
            .update({ is_active: true, updated_at: new Date().toISOString() } as any)
            .eq('id', id);
        return;
    }
    if (error) throw error;
}

export async function updateItemRemarks(id: string, remarks: string) {
    const supabase = createAdminClient();
    const { error } = await supabase
        .from('inventory_items')
        .update({ remarks, updated_at: new Date().toISOString() } as any)
        .eq('id', id);
    if (error) throw error;
}

export async function deleteInventoryItem(id: string) {
    const supabase = createAdminClient();
    const { error } = await supabase.from('inventory_items').delete().eq('id', id);
    if (error) throw error;
}

export async function addInboundLog(log: Omit<InboundLog, 'id' | 'created_at'>) {
    const supabase = createAdminClient();
    const { data, error } = await supabase.from('inventory_inbound_logs').insert(log as any).select().single();
    if (error) throw error;
    return data;
}

export async function addAdjustmentLog(log: Omit<AdjustmentLog, 'id' | 'created_at'>) {
    const supabase = createAdminClient();
    const { data, error } = await supabase.from('inventory_adjustment_logs').insert(log as any).select().single();
    if (error) throw error;
    return data;
}

export async function getMonthlyInboundLogs(month: string) {
    const supabase = createAdminClient();
    const startDate = `${month}-01`;
    const endOfMonth = new Date(new Date(month).getFullYear(), new Date(month).getMonth() + 1, 0);
    const endDate = endOfMonth.toISOString().split('T')[0];

    const { data, error } = await supabase
        .from('inventory_inbound_logs')
        .select(`
            *,
            item:inventory_items(name, category)
        `)
        .gte('date', startDate)
        .lte('date', endDate);
    if (error) throw error;
    return data || [];
}

export async function getMonthlyUsageLogs(month: string, bucket: string = '陽光庫存') {
    const supabase = createAdminClient();
    const startDate = `${month}-01`;
    const endOfMonth = new Date(new Date(month).getFullYear(), new Date(month).getMonth() + 1, 0);
    const endDate = endOfMonth.toISOString().split('T')[0];

    let query = supabase
        .from('inventory_usage_logs')
        .select('*, item:inventory_items(name, category, bucket)')
        .in('status', ['已確認', '已封存'])
        .gte('date', startDate)
        .lte('date', endDate);

    if (bucket) {
        query = query.eq('bucket', bucket);
    }

    const { data, error } = await query.order('date', { ascending: false });

    if (error) {
        console.error("[repo] getMonthlyUsageLogs failed");
        console.error("Table: inventory_usage_logs");
        console.error("原始錯誤:", error);
        throw error;
    }
    return data;
}

export async function upsertUsageLog(log: Partial<UsageLog>) {
    const supabase = createAdminClient();
    const { data, error } = await (supabase.from('inventory_usage_logs') as any).upsert(log).select().single();
    if (error) throw error;
    return data;
}

export async function deleteUsageLog(id: string) {
    const supabase = createAdminClient();
    const { error } = await supabase.from('inventory_usage_logs').delete().eq('id', id);
    if (error) throw error;
}

export async function isMonthArchived(month: string) {
    const supabase = createAdminClient();
    const { data } = await supabase
        .from('inventory_snapshots')
        .select('id')
        .eq('month', month)
        .limit(1);
    return (data?.length || 0) > 0;
}

export async function getInventorySummary(month: string, bucket: string = '陽光庫存') {
    const SUPABASE_CLIENT = createAdminClient();

    // Check for existing snapshot
    let snapQuery = SUPABASE_CLIENT
        .from('inventory_snapshots')
        .select(`
            *,
            item:inventory_items(name, category, bucket, remarks)
        `)
        .eq('month', month);

    const { data: snapshots, error: snapError } = await snapQuery;

    if (snapshots && snapshots.length > 0) {
        let filtered = snapshots;
        if (bucket) {
            filtered = snapshots.filter((s: any) => s.item?.bucket === bucket);
        }
        return filtered.map(s => ({
            id: s.item_id,
            name: (s as any).item?.name || '未知品項',
            category: (s as any).item?.category || '一般用料',
            bucket: (s as any).item?.bucket || '陽光庫存',
            opening_qty: Number(s.opening_qty),
            inbound_qty: Number(s.inbound_qty),
            outbound_qty: Number(s.outbound_qty),
            adjustment_qty: (s as any).adjustment_qty ? Number((s as any).adjustment_qty) : 0,
            closing_qty: Number(s.closing_qty),
            remarks: (s as any).item?.remarks || ''
        }));
    }

    const startOfMonth = new Date(`${month}-01`);
    const endOfMonth = new Date(startOfMonth.getFullYear(), startOfMonth.getMonth() + 1, 0, 23, 59, 59);

    // If no snapshot, calculate dynamically
    const itemsList = await getInventoryItems(false).then(list => bucket ? list.filter(i => i.bucket === bucket) : list);
    const itemIds = itemsList.map(i => i.id);

    if (itemIds.length === 0) return [];

    const dateStr = startOfMonth.toISOString().substring(0, 10);
    const endDateStr = endOfMonth.toISOString().substring(0, 10);

    // 獨立處理 adjustment 查詢，若表不存在則優雅降級為空陣列
    const fetchAdjBefore = SUPABASE_CLIENT
        .from('inventory_adjustment_logs').select('item_id, qty').in('item_id', itemIds).lt('date', dateStr)
        .then(res => res.error ? { data: [], error: null, __isFallback: true, orgError: res.error } : res);

    const fetchAdjCurrent = SUPABASE_CLIENT
        .from('inventory_adjustment_logs').select('item_id, qty').in('item_id', itemIds).gte('date', dateStr).lte('date', endDateStr)
        .then(res => res.error ? { data: [], error: null, __isFallback: true, orgError: res.error } : res);

    const [inboundBefore, inboundCurrent, usageBefore, usageCurrent, adjBefore, adjCurrent] = await Promise.all([
        SUPABASE_CLIENT.from('inventory_inbound_logs').select('item_id, qty').in('item_id', itemIds).lt('date', dateStr),
        SUPABASE_CLIENT.from('inventory_inbound_logs').select('item_id, qty').in('item_id', itemIds).gte('date', dateStr).lte('date', endDateStr),
        SUPABASE_CLIENT.from('inventory_usage_logs').select('item_id, qty').in('item_id', itemIds).in('status', ['已確認', '已封存']).lt('date', dateStr),
        SUPABASE_CLIENT.from('inventory_usage_logs').select('item_id, qty').in('item_id', itemIds).in('status', ['已確認', '已封存']).gte('date', dateStr).lte('date', endDateStr),
        fetchAdjBefore,
        fetchAdjCurrent
    ]);

    // Check for critical errors only
    if (inboundBefore.error || inboundCurrent.error || usageBefore.error || usageCurrent.error) {
        console.error("[repo] getInventorySummary dynamic calc failed (Critical Logs)", {
            inboundBefore: inboundBefore.error,
            inboundCurrent: inboundCurrent.error,
            usageBefore: usageBefore.error,
            usageCurrent: usageCurrent.error
        });
        throw inboundBefore.error || inboundCurrent.error || usageBefore.error || usageCurrent.error;
    }

    // Log the graceful degradation of adjustment queries
    if ((adjBefore as any).__isFallback || (adjCurrent as any).__isFallback) {
        console.warn("[repo] getInventorySummary: 'inventory_adjustment_logs' table might be missing or inaccessible. Temporarily defaulting adjustment quantities to 0 to prevent UI crash. Error details:", (adjBefore as any).orgError || (adjCurrent as any).orgError);
    }

    return itemsList.map(item => {
        const itemInboundBefore = (inboundBefore.data || [])
            .filter(l => l.item_id === item.id)
            .reduce((sum, l) => sum + Number(l.qty), 0);
        const itemUsageBefore = (usageBefore.data || [])
            .filter(l => l.item_id === item.id)
            .reduce((sum, l) => sum + Number(l.qty), 0);
        const itemAdjBefore = (adjBefore.data || [])
            .filter(l => l.item_id === item.id)
            .reduce((sum, l) => sum + Number(l.qty), 0);

        const opening_qty = itemInboundBefore - itemUsageBefore + itemAdjBefore;

        const itemInboundCurrent = (inboundCurrent.data || [])
            .filter(l => l.item_id === item.id)
            .reduce((sum, l) => sum + Number(l.qty), 0);
        const itemUsageCurrent = (usageCurrent.data || [])
            .filter(l => l.item_id === item.id)
            .reduce((sum, l) => sum + Number(l.qty), 0);
        const itemAdjCurrent = (adjCurrent.data || [])
            .filter(l => l.item_id === item.id)
            .reduce((sum, l) => sum + Number(l.qty), 0);

        return {
            ...item,
            opening_qty,
            inbound_qty: itemInboundCurrent,
            outbound_qty: itemUsageCurrent,
            adjustment_qty: itemAdjCurrent,
            closing_qty: opening_qty + itemInboundCurrent - itemUsageCurrent + itemAdjCurrent
        };
    });
}

export async function archiveInventory(month: string) {
    const summary = await getInventorySummary(month);
    const supabase = createAdminClient();

    const snapshots = summary.map((s: any) => ({
        month,
        item_id: s.id,
        opening_qty: s.opening_qty,
        inbound_qty: s.inbound_qty,
        outbound_qty: s.outbound_qty,
        closing_qty: s.closing_qty,
        archived_at: new Date().toISOString()
    }));

    const { error: snapshotError } = await (supabase.from('inventory_snapshots') as any).upsert(snapshots, { onConflict: 'month,item_id' });
    if (snapshotError) throw snapshotError;

    const startDate = `${month}-01`;
    const endOfMonth = new Date(new Date(month).getFullYear(), new Date(month).getMonth() + 1, 0);
    const endDate = endOfMonth.toISOString().split('T')[0];

    await (supabase.from('inventory_usage_logs') as any)
        .update({ status: '已封存' })
        .eq('status', '已確認')
        .gte('date', startDate)
        .lte('date', endDate);
}

export async function getItemLogs(itemId: string) {
    const supabase = createAdminClient();
    const [inbound, usage, adj] = await Promise.all([
        supabase.from('inventory_inbound_logs').select('*').eq('item_id', itemId).order('date', { ascending: false }),
        supabase.from('inventory_usage_logs').select('*').eq('item_id', itemId).in('status', ['已確認', '已封存']).order('date', { ascending: false }),
        supabase.from('inventory_adjustment_logs').select('*').eq('item_id', itemId).order('date', { ascending: false })
    ]);

    const logs = [
        ...(inbound.data || []).map(l => ({ ...l, type: '入庫', qty_change: Number(l.qty) })),
        ...(usage.data || []).map(l => ({ ...l, type: '正式出庫', qty_change: -Number(l.qty) })),
        ...(adj.data || []).map(l => ({ ...l, type: '庫存調整', qty_change: Number(l.qty) }))
    ];

    return logs.sort((a, b) => {
        const dateA = new Date((a as any).date).getTime();
        const dateB = new Date((b as any).date).getTime();
        if (dateB !== dateA) return dateB - dateA;
        return new Date((b as any).created_at).getTime() - new Date((a as any).created_at).getTime();
    });
}
