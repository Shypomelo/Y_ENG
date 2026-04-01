"use server";

import { createAdminClient } from '../supabase/admin'
import { Database, Project, ProjectStep } from '../types/database'

type ProjectInsert = Database['public']['Tables']['projects']['Insert']

export async function listProjects(): Promise<Project[]> {
    try {
        const supabase = createAdminClient()
        const { data, error } = await supabase
            .from('projects')
            .select('*')
            .order('created_at', { ascending: false })

        if (error) {
            console.error('listProjects Error:', error.message);
            return [];
        }
        return data || []
    } catch (err: any) {
        console.error('listProjects Configuration Error:', err.message);
        return [];
    }
}

export async function listProjectsWithSteps(): Promise<{ project: Project, steps: ProjectStep[] }[]> {
    try {
        const supabase = createAdminClient()

        // 1. Fetch all projects
        const { data: projects, error: projectsError } = await supabase
            .from('projects')
            .select('*')
            .order('created_at', { ascending: false })

        if (projectsError) {
            console.error('listProjectsWithSteps (Projects) Error:', projectsError.message);
            return [];
        }
        if (!projects || projects.length === 0) return []

        // 2. Fetch all steps for these projects
        const projectIds = projects.map(p => p.id)
        const { data: allSteps, error: stepsError } = await supabase
            .from('project_steps')
            .select('*')
            .in('project_id', projectIds)
            .order('sort_order', { ascending: true })

        if (stepsError) {
            console.error('listProjectsWithSteps (Steps) Error:', stepsError.message);
            // Even if steps fail, we can return projects with empty steps
        }

        // 3. Group steps by project_id
        const stepsByProject = (allSteps || []).reduce((acc, step) => {
            if (!acc[step.project_id]) acc[step.project_id] = []
            acc[step.project_id].push(step)
            return acc
        }, {} as Record<string, ProjectStep[]>)

        return projects.map(project => ({
            project,
            steps: stepsByProject[project.id] || []
        }))
    } catch (err: any) {
        console.error('listProjectsWithSteps Configuration Error:', err.message);
        return [];
    }
}

export async function getProjectDetail(projectId: string): Promise<{ project: Project, steps: ProjectStep[] }> {
    const supabase = createAdminClient()

    const [projectResult, stepsResult] = await Promise.all([
        supabase.from('projects').select('*').eq('id', projectId).single(),
        supabase.from('project_steps').select('*').eq('project_id', projectId).order('sort_order', { ascending: true })
    ])

    if (projectResult.error) throw projectResult.error
    if (stepsResult.error) throw stepsResult.error

    return {
        project: projectResult.data,
        steps: stepsResult.data || []
    }
}

export async function createProject(project: ProjectInsert): Promise<Project> {
    const supabase = createAdminClient()
    const { data, error } = await supabase
        .from('projects')
        .insert(project)
        .select()
        .single()

    if (error) throw error
    return data
}

export async function updateProjectBasicInfo(id: string, updates: Partial<Project>): Promise<Project> {
    const supabase = createAdminClient()
    const { data, error } = await supabase
        .from('projects')
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq('id', id)
        .select()
        .single()

    if (error) throw error
    return data
}

export async function updateProjectRoles(id: string, roles: Partial<Pick<Project, 'engineer_id' | 'project_manager_id' | 'sales_id' | 'structure_id' | 'admin_id'>>): Promise<Project> {
    return updateProjectBasicInfo(id, roles)
}

export async function updateProjectVendors(id: string, vendors: Partial<Pick<Project, 'structure_vendor_id' | 'electrical_vendor_id'>>): Promise<Project> {
    return updateProjectBasicInfo(id, vendors)
}

// Auto-offset calculation based on the new date
export async function updateProjectStepDate(id: string, dateType: 'baseline_date' | 'current_planned_date' | 'actual_date', newDate: string | null): Promise<ProjectStep> {
    const supabase = createAdminClient()

    // 1. Get current step
    const { data: currentStep, error: stepError } = await supabase
        .from('project_steps')
        .select('*')
        .eq('id', id)
        .single()

    if (stepError) throw stepError

    // 2. Base update
    const { data: updatedStep, error: updateError } = await supabase
        .from('project_steps')
        .update({ [dateType]: newDate, updated_at: new Date().toISOString() })
        .eq('id', id)
        .select()
        .single()

    if (updateError) throw updateError

    // 3. Optional: apply auto-postpone logic here if current_planned_date and newDate is not null
    if (dateType === 'current_planned_date' && newDate && currentStep.current_planned_date) {
        const oldTime = new Date(currentStep.current_planned_date).getTime()
        const newTime = new Date(newDate).getTime()
        const diffDays = Math.round((newTime - oldTime) / (1000 * 60 * 60 * 24))

        if (diffDays !== 0) {
            // Find subsequent steps that are NOT actual complete
            const { data: subsequentSteps } = await supabase
                .from('project_steps')
                .select('*')
                .eq('project_id', currentStep.project_id)
                .gt('sort_order', currentStep.sort_order || 0)
                .is('actual_date', null)

            if (subsequentSteps && subsequentSteps.length > 0) {
                // Shift them by diffDays
                for (const step of subsequentSteps) {
                    if (step.current_planned_date) {
                        const stepDate = new Date(step.current_planned_date)
                        stepDate.setDate(stepDate.getDate() + diffDays)

                        // We use simple iteration as transactions in browser client aren't atomic RPCs
                        // In a robust implementation, this would be an RPC function inside Supabase
                        await supabase
                            .from('project_steps')
                            .update({ current_planned_date: stepDate.toISOString().split('T')[0] })
                            .eq('id', step.id)
                    }
                }
            }
        }
    }

    return updatedStep
}

export async function addProjectStep(step: Omit<ProjectStep, 'id' | 'created_at' | 'updated_at'>): Promise<ProjectStep> {
    const supabase = createAdminClient()
    const { data, error } = await supabase
        .from('project_steps')
        .insert(step)
        .select()
        .single()

    if (error) throw error
    return data
}

export async function updateProjectStepStatus(id: string, status: string, reason?: string): Promise<ProjectStep> {
    const supabase = createAdminClient()
    const { data, error } = await supabase
        .from('project_steps')
        .update({ status, delay_reason: reason, updated_at: new Date().toISOString() })
        .eq('id', id)
        .select()
        .single()

    if (error) throw error
    return data
}

export async function deleteProject(id: string): Promise<void> {
    const supabase = createAdminClient()

    // 1. Delete associated steps
    const { error: stepsError } = await supabase
        .from('project_steps')
        .delete()
        .eq('project_id', id)

    if (stepsError) {
        console.error('deleteProject (Steps) Error:', stepsError.message);
        throw stepsError;
    }

    // 2. Delete the project itself
    const { error: projectError } = await supabase
        .from('projects')
        .delete()
        .eq('id', id)

    if (projectError) {
        console.error('deleteProject (Project) Error:', projectError.message);
        throw projectError;
    }
}
