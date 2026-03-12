import 'server-only'

import { createAdminClient } from '../supabase/admin'
import { DailySchedule } from '../types/database'

export async function listSchedules(startDate: string, endDate: string): Promise<DailySchedule[]> {
    const supabase = createAdminClient()
    const { data, error } = await supabase
        .from('daily_schedules')
        .select('*')
        .gte('schedule_date', startDate)
        .lte('schedule_date', endDate)
        .order('schedule_date', { ascending: true })
        .order('start_time', { ascending: true })

    if (error) {
        throw new Error(JSON.stringify({
            code: error?.code,
            message: error?.message,
            details: error?.details,
            hint: error?.hint,
            status: (error as any)?.status,
            table: 'daily_schedules',
            operation: 'list',
            payload: { startDate, endDate },
        }, null, 2))
    }
    return data || []
}

export async function listApplications(): Promise<DailySchedule[]> {
    const supabase = createAdminClient()
    const { data, error } = await supabase
        .from('daily_schedules')
        .select('*')
        .eq('status', 'application')
        .order('created_at', { ascending: false })

    if (error) {
        throw new Error(JSON.stringify({
            code: error?.code,
            message: error?.message,
            details: error?.details,
            hint: error?.hint,
            status: (error as any)?.status,
            table: 'daily_schedules',
            operation: 'list_applications',
        }, null, 2))
    }
    return data || []
}

export async function createSchedule(schedule: Omit<DailySchedule, 'id' | 'created_at' | 'updated_at'>): Promise<DailySchedule> {
    const supabase = createAdminClient()
    const { data, error } = await supabase
        .from('daily_schedules')
        .insert(schedule)
        .select()
        .single()

    if (error) {
        throw new Error(JSON.stringify({
            code: error?.code,
            message: error?.message,
            details: error?.details,
            hint: error?.hint,
            status: (error as any)?.status,
            table: 'daily_schedules',
            operation: 'insert',
            payload: schedule,
        }, null, 2))
    }
    return data
}

export async function updateSchedule(id: string, updates: Partial<DailySchedule>): Promise<DailySchedule> {
    const supabase = createAdminClient()
    const { data, error } = await supabase
        .from('daily_schedules')
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq('id', id)
        .select()
        .single()

    if (error) {
        throw new Error(JSON.stringify({
            code: error?.code,
            message: error?.message,
            details: error?.details,
            hint: error?.hint,
            status: (error as any)?.status,
            table: 'daily_schedules',
            operation: 'update',
            payload: updates,
            id
        }, null, 2))
    }
    return data
}

export async function deleteSchedule(id: string): Promise<void> {
    const supabase = createAdminClient()
    const { error } = await supabase
        .from('daily_schedules')
        .delete()
        .eq('id', id)

    if (error) {
        throw new Error(JSON.stringify({
            code: error?.code,
            message: error?.message,
            details: error?.details,
            hint: error?.hint,
            status: (error as any)?.status,
            table: 'daily_schedules',
            operation: 'delete',
            payload: { id },
            id
        }, null, 2))
    }
}
