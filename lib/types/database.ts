export type Json =
    | string
    | number
    | boolean
    | null
    | { [key: string]: Json | undefined }
    | Json[]

export type Database = {
    public: {
        Tables: {
            staff_members: {
                Row: {
                    id: string
                    name: string
                    department: string
                    is_active: boolean
                    created_at: string
                }
                Insert: {
                    id?: string
                    name: string
                    department: string
                    is_active?: boolean
                    created_at?: string
                }
                Update: {
                    id?: string
                    name?: string
                    department?: string
                    is_active?: boolean
                    created_at?: string
                }
                Relationships: []
            }
            vendors: {
                Row: {
                    id: string
                    name: string
                    category: string
                    is_active: boolean
                    created_at: string
                }
                Insert: {
                    id?: string
                    name: string
                    category: string
                    is_active?: boolean
                    created_at?: string
                }
                Update: {
                    id?: string
                    name?: string
                    category?: string
                    is_active?: boolean
                    created_at?: string
                }
                Relationships: []
            }
            flow_templates: {
                Row: {
                    id: string
                    name: string
                    department: string
                    is_active: boolean
                    created_at: string
                }
                Insert: {
                    id?: string
                    name: string
                    department: string
                    is_active?: boolean
                    created_at?: string
                }
                Update: {
                    id?: string
                    name?: string
                    department?: string
                    is_active?: boolean
                    created_at?: string
                }
                Relationships: []
            }
            flow_template_steps: {
                Row: {
                    id: string
                    template_id: string
                    step_key: string
                    step_name: string
                    owner_role: string | null
                    offset_days: number | null
                    base_offset_days: number | null
                    depends_on: Json | null
                    kw_tiers: Json | null
                    is_core: boolean | null
                    deliverable: string | null
                    sort_order: number | null
                    is_active: boolean
                    created_at: string
                }
                Insert: {
                    id?: string
                    template_id: string
                    step_key: string
                    step_name: string
                    owner_role?: string | null
                    offset_days?: number | null
                    base_offset_days?: number | null
                    depends_on?: Json | null
                    kw_tiers?: Json | null
                    is_core?: boolean | null
                    deliverable?: string | null
                    sort_order?: number | null
                    is_active?: boolean
                    created_at?: string
                }
                Update: {
                    id?: string
                    template_id?: string
                    step_key?: string
                    step_name?: string
                    owner_role?: string | null
                    offset_days?: number | null
                    base_offset_days?: number | null
                    depends_on?: Json | null
                    kw_tiers?: Json | null
                    is_core?: boolean | null
                    deliverable?: string | null
                    sort_order?: number | null
                    is_active?: boolean
                    created_at?: string
                }
                Relationships: [
                    {
                        foreignKeyName: "flow_template_steps_template_id_fkey"
                        columns: ["template_id"]
                        isOneToOne: false
                        referencedRelation: "flow_templates"
                        referencedColumns: ["id"]
                    }
                ]
            }
            projects: {
                Row: {
                    id: string
                    name: string
                    kwp: number
                    engineer_id: string | null
                    project_manager_id: string | null
                    sales_id: string | null
                    structure_id: string | null
                    admin_id: string | null
                    structure_vendor_id: string | null
                    electrical_vendor_id: string | null
                    current_step_key: string | null
                    next_step_key: string | null
                    projected_meter_date: string | null
                    status_flag: string | null
                    is_important: boolean
                    is_closed: boolean
                    owners: Json | null
                    created_at: string
                    updated_at: string
                }
                Insert: {
                    id?: string
                    name: string
                    kwp: number
                    engineer_id?: string | null
                    project_manager_id?: string | null
                    sales_id?: string | null
                    structure_id?: string | null
                    admin_id?: string | null
                    structure_vendor_id?: string | null
                    electrical_vendor_id?: string | null
                    current_step_key?: string | null
                    next_step_key?: string | null
                    projected_meter_date?: string | null
                    status_flag?: string | null
                    is_important?: boolean
                    is_closed?: boolean
                    owners?: Json | null
                    created_at?: string
                    updated_at?: string
                }
                Update: {
                    id?: string
                    name?: string
                    kwp?: number
                    engineer_id?: string | null
                    project_manager_id?: string | null
                    sales_id?: string | null
                    structure_id?: string | null
                    admin_id?: string | null
                    structure_vendor_id?: string | null
                    electrical_vendor_id?: string | null
                    current_step_key?: string | null
                    next_step_key?: string | null
                    projected_meter_date?: string | null
                    status_flag?: string | null
                    is_important?: boolean
                    is_closed?: boolean
                    owners?: Json | null
                    created_at?: string
                    updated_at?: string
                }
                Relationships: []
            }
            project_steps: {
                Row: {
                    id: string
                    project_id: string
                    template_step_key: string
                    step_name: string
                    owner_role: string | null
                    sort_order: number | null
                    baseline_date: string | null
                    current_planned_date: string | null
                    actual_date: string | null
                    status: string | null
                    delay_reason: string | null
                    metadata: Json | null
                    created_at: string
                    updated_at: string
                }
                Insert: {
                    id?: string
                    project_id: string
                    template_step_key: string
                    step_name: string
                    owner_role?: string | null
                    sort_order?: number | null
                    baseline_date?: string | null
                    current_planned_date?: string | null
                    actual_date?: string | null
                    status?: string | null
                    delay_reason?: string | null
                    metadata?: Json | null
                    created_at?: string
                    updated_at?: string
                }
                Update: {
                    id?: string
                    project_id?: string
                    template_step_key?: string
                    step_name?: string
                    owner_role?: string | null
                    sort_order?: number | null
                    baseline_date?: string | null
                    current_planned_date?: string | null
                    actual_date?: string | null
                    status?: string | null
                    delay_reason?: string | null
                    metadata?: Json | null
                    created_at?: string
                    updated_at?: string
                }
                Relationships: [
                    {
                        foreignKeyName: "project_steps_project_id_fkey"
                        columns: ["project_id"]
                        isOneToOne: false
                        referencedRelation: "projects"
                        referencedColumns: ["id"]
                    }
                ]
            }
            daily_schedules: {
                Row: {
                    id: string
                    case_name: string
                    schedule_date: string | null
                    start_time: string | null
                    end_time: string | null
                    assignee_ids: string[] | null
                    engineer_id: string | null
                    project_id: string | null
                    case_type: string | null
                    address: string | null
                    description: string | null
                    status: string | null
                    created_at: string
                    updated_at: string
                }
                Insert: {
                    id?: string
                    case_name: string
                    schedule_date?: string | null
                    start_time?: string | null
                    end_time?: string | null
                    assignee_ids?: string[] | null
                    engineer_id?: string | null
                    project_id?: string | null
                    case_type?: string | null
                    address?: string | null
                    description?: string | null
                    status?: string | null
                    created_at?: string
                    updated_at?: string
                }
                Update: {
                    id?: string
                    case_name?: string
                    schedule_date?: string | null
                    start_time?: string | null
                    end_time?: string | null
                    assignee_ids?: string[] | null
                    engineer_id?: string | null
                    project_id?: string | null
                    case_type?: string | null
                    address?: string | null
                    description?: string | null
                    status?: string | null
                    created_at?: string
                    updated_at?: string
                }
                Relationships: [
                    {
                        foreignKeyName: "daily_schedules_project_id_fkey"
                        columns: ["project_id"]
                        isOneToOne: false
                        referencedRelation: "projects"
                        referencedColumns: ["id"]
                    },
                    {
                        foreignKeyName: "daily_schedules_engineer_id_fkey"
                        columns: ["engineer_id"]
                        isOneToOne: false
                        referencedRelation: "staff_members"
                        referencedColumns: ["id"]
                    }
                ]
            }
            todo_items: {
                Row: {
                    id: string
                    title: string
                    is_completed: boolean
                    created_at: string
                    updated_at: string
                }
                Insert: {
                    id?: string
                    title: string
                    is_completed?: boolean
                    created_at?: string
                    updated_at?: string
                }
                Update: {
                    id?: string
                    title?: string
                    is_completed?: boolean
                    created_at?: string
                    updated_at?: string
                }
                Relationships: []
            }
            system_settings: {
                Row: {
                    id: string
                    value: any
                    created_at: string
                    updated_at: string
                }
                Insert: {
                    id: string
                    value: any
                    created_at?: string
                    updated_at?: string
                }
                Update: {
                    id?: string
                    value?: any
                    created_at?: string
                    updated_at?: string
                }
                Relationships: []
            }
        }
        Views: {
            [key: string]: {
                Row: Record<string, unknown>
                Insert: Record<string, never>
                Update: Record<string, never>
                Relationships: []
            }
        }
        Functions: {
            [key: string]: {
                Args: Record<string, unknown>
                Returns: unknown
            }
        }
        Enums: {
            [key: string]: never
        }
        CompositeTypes: {
            [key: string]: unknown
        }
    }
}

export type StaffMember = Database['public']['Tables']['staff_members']['Row']
export type Vendor = Database['public']['Tables']['vendors']['Row']
export type FlowTemplate = Database['public']['Tables']['flow_templates']['Row']
export type FlowTemplateStep = Database['public']['Tables']['flow_template_steps']['Row']
export type Project = Database['public']['Tables']['projects']['Row']
export type ProjectStep = Database['public']['Tables']['project_steps']['Row']
export type DailySchedule = Database['public']['Tables']['daily_schedules']['Row']
export type TodoItem = Database['public']['Tables']['todo_items']['Row']
export type SystemSetting = Database['public']['Tables']['system_settings']['Row']
