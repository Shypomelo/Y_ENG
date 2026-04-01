"use server";

import { createAdminClient } from '../supabase/admin'
import { FlowTemplate, FlowTemplateStep } from '../types/database'

export async function listFlowTemplates(department?: string): Promise<FlowTemplate[]> {
    const supabase = createAdminClient()
    let query = supabase.from('flow_templates').select('*').eq('is_active', true)

    if (department) {
        query = query.eq('department', department)
    }

    const { data, error } = await query.order('created_at', { ascending: true })
    if (error) throw error
    return data || []
}

export async function getFlowTemplateWithSteps(templateId: string): Promise<{ template: FlowTemplate, steps: FlowTemplateStep[] }> {
    const supabase = createAdminClient()

    const [templateResult, stepsResult] = await Promise.all([
        supabase.from('flow_templates').select('*').eq('id', templateId).single(),
        supabase.from('flow_template_steps').select('*').eq('template_id', templateId).eq('is_active', true).order('sort_order', { ascending: true })
    ])

    if (templateResult.error) throw templateResult.error
    if (stepsResult.error) throw stepsResult.error

    return {
        template: templateResult.data,
        steps: stepsResult.data || []
    }
}

export async function createFlowTemplate(name: string, department: string): Promise<FlowTemplate> {
    const supabase = createAdminClient()
    const { data, error } = await supabase
        .from('flow_templates')
        .insert({ name, department })
        .select()
        .single()

    if (error) throw error
    return data
}

export async function createFlowTemplateStep(step: Omit<FlowTemplateStep, 'id' | 'is_active' | 'created_at'>): Promise<FlowTemplateStep> {
    const supabase = createAdminClient()
    const { data, error } = await supabase
        .from('flow_template_steps')
        .insert(step)
        .select()
        .single()

    if (error) throw error
    return data
}

export async function updateFlowTemplateStep(id: string, updates: Partial<FlowTemplateStep>): Promise<FlowTemplateStep> {
    const supabase = createAdminClient()
    const { data, error } = await supabase
        .from('flow_template_steps')
        .update(updates)
        .eq('id', id)
        .select()
        .single()

    if (error) throw error
    return data
}

export async function deleteFlowTemplateStep(id: string): Promise<void> {
    const supabase = createAdminClient()
    const { error } = await supabase
        .from('flow_template_steps')
        .delete()
        .eq('id', id)

    if (error) throw error
}

/**
 * 取得所有 Flow資料，並整理成 UI 格式 (deptFlows + masterFlowOrder)
 * 預設將 'Master' 作為整合的主模板，其餘作為部門模板。
 */
export async function fetchAllFlowConfig() {
    const supabase = createAdminClient()
    const { data: templates, error: tmplErr } = await supabase.from('flow_templates').select('*').eq('is_active', true)
    if (tmplErr) throw tmplErr

    const { data: steps, error: stepErr } = await supabase.from('flow_template_steps').select('*').eq('is_active', true).order('sort_order', { ascending: true })
    if (stepErr) throw stepErr

    return { templates, steps }
}

export async function upsertFlowTemplate(name: string, department: string) {
    const supabase = createAdminClient()
    const { data, error } = await supabase
        .from('flow_templates')
        .upsert({ name, department }, { onConflict: 'name' })
        .select()
        .single()
    if (error) throw error
    return data
}

/**
 * 完全同步 UI 狀態到 Supabase (暴力 Replace 以維持完全一致，適合 MVP)
 */
export async function syncAllFlowConfig(masterNodes: any[], deptConfig: any) {
    const supabase = createAdminClient()

    // 1. Get or create templates
    const depts = ['Master', '工程', '專案', '業務', '結構', '行政']
    const tmplMap: Record<string, string> = {}

    for (const d of depts) {
        try {
            // 1.1 Find existing template by name
            const { data: existing, error: findError } = await supabase.from('flow_templates')
                .select('id')
                .eq('name', d)
                .eq('is_active', true)
                .maybeSingle()
            
            if (findError) {
                console.error(`[Flow Sync] Error checking for template ${d}:`, findError)
                throw new Error(`查詢 ${d} 流程模板失敗: ${findError.message}`)
            }

            let templateId: string;

            if (existing) {
                // 1.2 Update existing
                const { data: updated, error: updateError } = await supabase.from('flow_templates')
                    .update({ department: d })
                    .eq('id', existing.id)
                    .select()
                    .single()
                
                if (updateError) {
                    console.error(`[Flow Sync] Failed to update template ${d}:`, updateError)
                    throw new Error(`更新 ${d} 流程模板失敗: ${updateError.message}`)
                }
                templateId = updated.id
            } else {
                // 1.3 Insert new
                const { data: created, error: insertError } = await supabase.from('flow_templates')
                    .insert({ name: d, department: d })
                    .select()
                    .single()
                
                if (insertError) {
                    console.error(`[Flow Sync] Failed to create template ${d}:`, insertError)
                    throw new Error(`建立 ${d} 流程模板失敗: ${insertError.message}`)
                }
                templateId = created.id
            }

            tmplMap[d] = templateId
            console.log(`[Flow Sync] Template ${d} ready with ID: ${templateId}`)
        } catch (e) {
            console.error(`[Flow Sync] Exception during template ${d} processing:`, e)
            throw e
        }
    }

    // 1.1 Final Template Validation
    const missingDepts = depts.filter(d => !tmplMap[d]);
    if (missingDepts.length > 0) {
        const errorMsg = `[Flow Sync] 關鍵錯誤：以下部門模板遺失 ID: ${missingDepts.join(', ')}`;
        console.error(errorMsg, { tmplMap });
        throw new Error(errorMsg);
    }

    // 2. Prepare steps insert array
    const stepsToInsert: any[] = []

    // Master
    const masterTmplId = tmplMap['Master'];
    if (masterTmplId) {
        console.log(`[Flow Sync] Preparing ${masterNodes.length} Master steps...`);
        masterNodes.forEach((n, idx) => {
            stepsToInsert.push({
                template_id: masterTmplId,
                step_key: n.id,
                step_name: n.name,
                owner_role: n.lane,
                is_core: n.is_core,
                depends_on: n.depends_on,
                deliverable: n.deliverable,
                offset_days: n.offset_days,
                sort_order: n.seq || idx + 1
            })
        })
    } else {
        console.warn("[Flow Sync] Master template ID missing, results in step omission")
    }

    // Depts
    Object.keys(deptConfig).forEach((code) => {
        const dConf = deptConfig[code]
        const deptTmplId = tmplMap[dConf.dept];
        if (deptTmplId) {
            dConf.steps.forEach((s: any, idx: number) => {
                stepsToInsert.push({
                    template_id: deptTmplId,
                    step_key: s.id,
                    step_name: s.name,
                    owner_role: s.dept,
                    depends_on: s.depends_on,
                    base_offset_days: s.base_offset_days,
                    kw_tiers: s.kw_tiers,
                    is_core: s.is_core,
                    sort_order: idx + 1
                })
            })
        } else {
            console.warn(`[Flow Sync] Template ID missing for department ${dConf.dept}, skipping department steps`)
        }
    })

    // 3. Wipe and Insert
    // Delete all active logic (we just hard delete or set is_active false, here we hard delete for simplicity)
    await supabase.from('flow_template_steps').delete().neq('id', '00000000-0000-0000-0000-000000000000') // delete all

    // Insert new
    if (stepsToInsert.length > 0) {
        // Final sanity check
        const validSteps = stepsToInsert.filter(s => !!s.template_id);
        const invalidCount = stepsToInsert.length - validSteps.length;
        
        if (invalidCount > 0) {
            console.error("[Flow Sync] CRITICAL: Found steps with null template_id!", {
                total: stepsToInsert.length,
                invalidCount,
                firstInvalid: stepsToInsert.find(s => !s.template_id)
            });
            // We do NOT want to insert if there are invalid steps, as it indicates a mapping bug.
            throw new Error(`同步終止：偵測到 ${invalidCount} 筆步驟缺少 template_id，請檢查部門名稱對照。`);
        }

        console.log(`[Flow Sync] Wiping old steps and inserting ${validSteps.length} new steps...`);
        const { error } = await supabase.from('flow_template_steps').insert(validSteps)
        if (error) {
            console.error("[Flow Sync] Massive insert failed", {
                message: error?.message,
                details: error?.details,
                hint: error?.hint,
                code: error?.code,
                status: (error as any)?.status,
                payloadSample: validSteps.slice(0, 2),
                firstStepTmplId: validSteps[0]?.template_id
            })
            throw new Error(`同步失敗：${error.message}`);
        }
        console.log(`[Flow Sync] Successfully synced ${validSteps.length} steps.`);
    } else {
        console.log("[Flow Sync] No steps to insert.");
    }
}


