"use server";

import { createAdminClient } from '../supabase/admin'
import { StaffMember } from '../types/database'

export async function listStaffByDepartment(department?: string): Promise<StaffMember[]> {
    const supabase = createAdminClient()
    let query = supabase.from('staff_members').select('*').eq('is_active', true)

    if (department) {
        query = query.eq('department', department)
    }

    const { data, error } = await query.order('created_at', { ascending: true })
    if (error) throw error
    return data || []
}

export async function createStaff(name: string, department: string): Promise<StaffMember> {
    const supabase = createAdminClient()
    const { data, error } = await supabase
        .from('staff_members')
        .insert({ name, department })
        .select()
        .single()

    if (error) throw error
    return data
}

export async function deleteStaff(id: string): Promise<void> {
    const supabase = createAdminClient()
    // Implementing soft delete as best practice, but could be hard delete
    const { error } = await supabase
        .from('staff_members')
        .update({ is_active: false })
        .eq('id', id)

    if (error) throw error
}
