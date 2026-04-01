import { createBrowserClient } from '@supabase/ssr'
import { Database } from '../types/database'

export function createClient() {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL
    const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

    if (!url || !key) {
        console.error('Supabase client error: Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY')
        // We still throw here because createBrowserClient requires valid strings, 
        // but we'll catch it in the UI or actions.
        throw new Error('Supabase Configuration Missing')
    }

    return createBrowserClient<Database>(url, key)
}
