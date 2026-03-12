import 'server-only'

import { createAdminClient } from '../supabase/admin'
import { SystemSetting } from '../types/database'

export async function getSetting<T>(id: string): Promise<T | null> {
    const supabase = createAdminClient()
    const { data, error } = await supabase
        .from('system_settings')
        .select('value')
        .eq('id', id)
        .maybeSingle()

    if (error) {
        console.error('getSetting Error (Falling back to null):', {
            id,
            code: error.code,
            message: error.message
        });
        return null;
    }
    return data?.value as T || null
}

export async function updateSetting(id: string, value: any): Promise<void> {
    const supabase = createAdminClient()
    const { error } = await supabase
        .from('system_settings')
        .upsert({ id, value, updated_at: new Date().toISOString() })

    if (error) {
        throw new Error(JSON.stringify({
            code: error?.code,
            message: error?.message,
            details: error?.details,
            hint: error?.hint,
            status: (error as any)?.status,
            table: 'system_settings',
            operation: 'upsert',
            payload: { id, value },
        }, null, 2))
    }
}
