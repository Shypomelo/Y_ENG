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
        const { data } = await supabase.from('flow_templates')
            .upsert({ name: d, department: d }, { onConflict: 'name' }).select().single()
        if (data) tmplMap[d] = data.id
    }

    // 2. Prepare steps insert array
    const stepsToInsert: any[] = []

    // Master
    masterNodes.forEach((n, idx) => {
        stepsToInsert.push({
            template_id: tmplMap['Master'],
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

    // Depts
    Object.keys(deptConfig).forEach((code) => {
        const dConf = deptConfig[code]
        dConf.steps.forEach((s: any, idx: number) => {
            stepsToInsert.push({
                template_id: tmplMap[dConf.dept],
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
    })

    // 3. Wipe and Insert
    // Delete all active logic (we just hard delete or set is_active false, here we hard delete for simplicity)
    await supabase.from('flow_template_steps').delete().neq('id', '00000000-0000-0000-0000-000000000000') // delete all

    // Insert new
    if (stepsToInsert.length > 0) {
        const { error } = await supabase.from('flow_template_steps').insert(stepsToInsert)
        if (error) console.error("Flow sync inserts failed", {
            message: error?.message,
            details: error?.details,
            hint: error?.hint,
            code: error?.code,
            status: (error as any)?.status,
        })
    }
}


