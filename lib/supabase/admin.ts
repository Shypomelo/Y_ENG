import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import { Database } from '../types/database'

export function createAdminClient() {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY

    if (!url || !key) {
        console.error('Supabase admin client error: Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')
        throw new Error('Supabase Admin Configuration Missing')
    }

    return createSupabaseClient<Database>(url, key, {
        auth: {
            autoRefreshToken: false,
            persistSession: false,
        },
    })
}
