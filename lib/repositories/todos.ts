import 'server-only'

import { createAdminClient } from '../supabase/admin'
import { TodoItem } from '../types/database'

export async function listTodos(): Promise<TodoItem[]> {
    const supabase = createAdminClient()
    const { data, error } = await supabase
        .from('todo_items')
        .select('*')
        .order('created_at', { ascending: false })

    if (error) {
        throw new Error(JSON.stringify({
            code: error?.code,
            message: error?.message,
            details: error?.details,
            hint: error?.hint,
            status: (error as any)?.status,
            table: 'todo_items',
            operation: 'list',
        }, null, 2))
    }
    return data || []
}

export async function createTodo(title: string): Promise<TodoItem> {
    const supabase = createAdminClient()
    const { data, error } = await supabase
        .from('todo_items')
        .insert({ title })
        .select()
        .single()

    if (error) {
        throw new Error(JSON.stringify({
            code: error?.code,
            message: error?.message,
            details: error?.details,
            hint: error?.hint,
            status: (error as any)?.status,
            table: 'todo_items',
            operation: 'insert',
            payload: { title }
        }, null, 2))
    }
    return data
}

export async function updateTodo(id: string, updates: Partial<TodoItem>): Promise<TodoItem> {
    const supabase = createAdminClient()
    const { data, error } = await supabase
        .from('todo_items')
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
            table: 'todo_items',
            operation: 'update',
            payload: updates,
            id
        }, null, 2))
    }
    return data
}

export async function deleteTodo(id: string): Promise<void> {
    const supabase = createAdminClient()
    const { error } = await supabase
        .from('todo_items')
        .delete()
        .eq('id', id)

    if (error) {
        throw new Error(JSON.stringify({
            code: error?.code,
            message: error?.message,
            details: error?.details,
            hint: error?.hint,
            status: (error as any)?.status,
            table: 'todo_items',
            operation: 'delete',
            payload: { id },
            id
        }, null, 2))
    }
}
