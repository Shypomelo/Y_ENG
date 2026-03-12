"use server";

import { createAdminClient } from '../supabase/admin'
import { Vendor } from '../types/database'

export async function listVendorsByCategory(category?: string): Promise<Vendor[]> {
    const supabase = createAdminClient()
    let query = supabase.from('vendors').select('*').eq('is_active', true)

    if (category) {
        query = query.eq('category', category)
    }

    const { data, error } = await query.order('created_at', { ascending: true })
    if (error) throw error
    return data || []
}

export async function createVendor(name: string, category: string): Promise<Vendor> {
    const supabase = createAdminClient()
    const { data, error } = await supabase
        .from('vendors')
        .insert({ name, category })
        .select()
        .single()

    if (error) throw error
    return data
}

export async function deleteVendor(id: string): Promise<void> {
    const supabase = createAdminClient()
    const { error } = await supabase
        .from('vendors')
        .update({ is_active: false })
        .eq('id', id)

    if (error) throw error
}
