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
            google_calendar_settings: {
                Row: {
                    id: string
                    calendar_id: string | null
                    calendar_name: string | null
                    sync_enabled: boolean
                    created_at: string
                    updated_at: string
                }
                Insert: {
                    id?: string
                    calendar_id?: string | null
                    calendar_name?: string | null
                    sync_enabled?: boolean
                    created_at?: string
                    updated_at?: string
                }
                Update: {
                    id?: string
                    calendar_id?: string | null
                    calendar_name?: string | null
                    sync_enabled?: boolean
                    created_at?: string
                    updated_at?: string
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
                    case_no: string | null
                    name: string
                    address: string | null
                    sale_type: string | null
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
                    site_contact_name: string | null
                    site_contact_phone: string | null
                    created_at: string
                    updated_at: string
                }
                Insert: {
                    id?: string
                    case_no?: string | null
                    name: string
                    address?: string | null
                    sale_type?: string | null
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
                    site_contact_name?: string | null
                    site_contact_phone?: string | null
                    created_at?: string
                    updated_at?: string
                }
                Update: {
                    id?: string
                    case_no?: string | null
                    name?: string
                    address?: string | null
                    sale_type?: string | null
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
                    site_contact_name?: string | null
                    site_contact_phone?: string | null
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
                    title: string
                    case_name: string
                    schedule_date: string | null
                    start_time: string | null
                    end_time: string | null
                    start_datetime: string | null
                    end_datetime: string | null
                    is_all_day: boolean | null
                    assignee_ids: string[] | null
                    engineer_id: string | null
                    project_id: string | null
                    case_type: string | null
                    address: string | null
                    description: string | null
                    status: string | null
                    source: string | null
                    google_event_id: string | null
                    google_calendar_id: string | null
                    sync_status: string | null
                    last_synced_at: string | null
                    created_at: string
                    updated_at: string
                }
                Insert: {
                    id?: string
                    title?: string
                    case_name: string
                    schedule_date?: string | null
                    start_time?: string | null
                    end_time?: string | null
                    start_datetime?: string | null
                    end_datetime?: string | null
                    is_all_day?: boolean | null
                    assignee_ids?: string[] | null
                    engineer_id?: string | null
                    project_id?: string | null
                    case_type?: string | null
                    address?: string | null
                    description?: string | null
                    status?: string | null
                    source?: string | null
                    google_event_id?: string | null
                    google_calendar_id?: string | null
                    sync_status?: string | null
                    last_synced_at?: string | null
                    created_at?: string
                    updated_at?: string
                }
                Update: {
                    id?: string
                    title?: string
                    case_name?: string
                    schedule_date?: string | null
                    start_time?: string | null
                    end_time?: string | null
                    start_datetime?: string | null
                    end_datetime?: string | null
                    is_all_day?: boolean | null
                    assignee_ids?: string[] | null
                    engineer_id?: string | null
                    project_id?: string | null
                    case_type?: string | null
                    address?: string | null
                    description?: string | null
                    status?: string | null
                    source?: string | null
                    google_event_id?: string | null
                    google_calendar_id?: string | null
                    sync_status?: string | null
                    last_synced_at?: string | null
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
            external_maintenance_tickets: {
                Row: {
                    id: string
                    source_system: string
                    external_id: string | null
                    fallback_key: string
                    is_fallback_identity: boolean
                    identity_confidence: string
                    source_region: string | null
                    source_case_no: string | null
                    source_case_name: string | null
                    source_report_time: string | null
                    source_reporter: string | null
                    source_report_issue: string | null
                    source_issue_summary: string | null
                    source_monitor_staff: string | null
                    source_monitor_judgement: string | null
                    source_monitor_note: string | null
                    source_repair_status: string | null
                    source_repair_staff: string | null
                    source_repair_note: string | null
                    source_work_date: string | null
                    source_complete_date: string | null
                    source_optimizer_count: number | null
                    source_payload: Json | null
                    source_payload_hash: string
                    source_row_html: string | null
                    source_dataset: Json | null
                    source_runtime_meta: Json | null
                    is_north: boolean
                    sync_status: string
                    first_seen_at: string
                    last_seen_at: string
                    last_synced_at: string
                    last_source_updated_at: string | null
                    linked_maintenance_report_id: string | null
                    linked_project_id: string | null
                    writeback_eligible: boolean
                    writeback_status: string
                    writeback_candidate: Json | null
                    writeback_last_checked_at: string | null
                    writeback_last_attempt_at: string | null
                    writeback_last_success_at: string | null
                    writeback_error: string | null
                    conflict_status: string
                    conflict_detail: Json | null
                    created_at: string
                    updated_at: string
                }
                Insert: {
                    id?: string
                    source_system: string
                    external_id?: string | null
                    fallback_key: string
                    is_fallback_identity?: boolean
                    identity_confidence?: string
                    source_region?: string | null
                    source_case_no?: string | null
                    source_case_name?: string | null
                    source_report_time?: string | null
                    source_reporter?: string | null
                    source_report_issue?: string | null
                    source_issue_summary?: string | null
                    source_monitor_staff?: string | null
                    source_monitor_judgement?: string | null
                    source_monitor_note?: string | null
                    source_repair_status?: string | null
                    source_repair_staff?: string | null
                    source_repair_note?: string | null
                    source_work_date?: string | null
                    source_complete_date?: string | null
                    source_optimizer_count?: number | null
                    source_payload?: Json | null
                    source_payload_hash: string
                    source_row_html?: string | null
                    source_dataset?: Json | null
                    source_runtime_meta?: Json | null
                    is_north?: boolean
                    sync_status?: string
                    first_seen_at?: string
                    last_seen_at?: string
                    last_synced_at?: string
                    last_source_updated_at?: string | null
                    linked_maintenance_report_id?: string | null
                    linked_project_id?: string | null
                    writeback_eligible?: boolean
                    writeback_status?: string
                    writeback_candidate?: Json | null
                    writeback_last_checked_at?: string | null
                    writeback_last_attempt_at?: string | null
                    writeback_last_success_at?: string | null
                    writeback_error?: string | null
                    conflict_status?: string
                    conflict_detail?: Json | null
                    created_at?: string
                    updated_at?: string
                }
                Update: {
                    id?: string
                    source_system?: string
                    external_id?: string | null
                    fallback_key?: string
                    is_fallback_identity?: boolean
                    identity_confidence?: string
                    source_region?: string | null
                    source_case_no?: string | null
                    source_case_name?: string | null
                    source_report_time?: string | null
                    source_reporter?: string | null
                    source_report_issue?: string | null
                    source_issue_summary?: string | null
                    source_monitor_staff?: string | null
                    source_monitor_judgement?: string | null
                    source_monitor_note?: string | null
                    source_repair_status?: string | null
                    source_repair_staff?: string | null
                    source_repair_note?: string | null
                    source_work_date?: string | null
                    source_complete_date?: string | null
                    source_optimizer_count?: number | null
                    source_payload?: Json | null
                    source_payload_hash?: string
                    source_row_html?: string | null
                    source_dataset?: Json | null
                    source_runtime_meta?: Json | null
                    is_north?: boolean
                    sync_status?: string
                    first_seen_at?: string
                    last_seen_at?: string
                    last_synced_at?: string
                    last_source_updated_at?: string | null
                    linked_maintenance_report_id?: string | null
                    linked_project_id?: string | null
                    writeback_eligible?: boolean
                    writeback_status?: string
                    writeback_candidate?: Json | null
                    writeback_last_checked_at?: string | null
                    writeback_last_attempt_at?: string | null
                    writeback_last_success_at?: string | null
                    writeback_error?: string | null
                    conflict_status?: string
                    conflict_detail?: Json | null
                    created_at?: string
                    updated_at?: string
                }
                Relationships: [
                    {
                        foreignKeyName: "external_maintenance_tickets_linked_maintenance_report_id_fkey"
                        columns: ["linked_maintenance_report_id"]
                        isOneToOne: false
                        referencedRelation: "maintenance_reports"
                        referencedColumns: ["id"]
                    },
                    {
                        foreignKeyName: "external_maintenance_tickets_linked_project_id_fkey"
                        columns: ["linked_project_id"]
                        isOneToOne: false
                        referencedRelation: "projects"
                        referencedColumns: ["id"]
                    }
                ]
            }
            maintenance_tickets: {
                Row: {
                    id: string
                    project_id: string | null
                    case_no: string | null
                    case_name: string
                    region: string | null
                    report_time: string | null
                    issue_summary: string | null
                    status: string | null
                    created_at: string
                    updated_at: string
                }
                Insert: {
                    id?: string
                    project_id?: string | null
                    case_no?: string | null
                    case_name: string
                    region?: string | null
                    report_time?: string | null
                    issue_summary?: string | null
                    status?: string | null
                    created_at?: string
                    updated_at?: string
                }
                Update: {
                    id?: string
                    project_id?: string | null
                    case_no?: string | null
                    case_name?: string
                    region?: string | null
                    report_time?: string | null
                    issue_summary?: string | null
                    status?: string | null
                    created_at?: string
                    updated_at?: string
                }
                Relationships: [
                    {
                        foreignKeyName: "maintenance_tickets_project_id_fkey"
                        columns: ["project_id"]
                        isOneToOne: false
                        referencedRelation: "projects"
                        referencedColumns: ["id"]
                    }
                ]
            }
            maintenance_reports: {
                Row: {
                    id: string
                    ticket_id: string | null
                    external_ticket_id: string | null
                    external_identity_snapshot: string | null
                    external_payload_hash_at_bind: string | null
                    external_last_compared_at: string | null
                    external_conflict_status: string | null
                    case_no: string | null
                    case_name: string
                    address: string | null
                    site_contact_name: string | null
                    site_contact_phone: string | null
                    repair_item: string | null
                    repair_notes: string | null
                    repair_staff: string | null
                    completed_at: string | null
                    status: string | null
                    workflow_state: string | null
                    returned_reason: string | null
                    reconciled_at: string | null
                    metadata: Json | null
                    created_at: string
                    updated_at: string
                }
                Insert: {
                    id?: string
                    ticket_id?: string | null
                    external_ticket_id?: string | null
                    external_identity_snapshot?: string | null
                    external_payload_hash_at_bind?: string | null
                    external_last_compared_at?: string | null
                    external_conflict_status?: string | null
                    case_no?: string | null
                    case_name: string
                    address?: string | null
                    site_contact_name?: string | null
                    site_contact_phone?: string | null
                    repair_item?: string | null
                    repair_notes?: string | null
                    repair_staff?: string | null
                    completed_at?: string | null
                    status?: string | null
                    workflow_state?: string | null
                    returned_reason?: string | null
                    reconciled_at?: string | null
                    metadata?: Json | null
                    created_at?: string
                    updated_at?: string
                }
                Update: {
                    id?: string
                    ticket_id?: string | null
                    external_ticket_id?: string | null
                    external_identity_snapshot?: string | null
                    external_payload_hash_at_bind?: string | null
                    external_last_compared_at?: string | null
                    external_conflict_status?: string | null
                    case_no?: string | null
                    case_name?: string
                    address?: string | null
                    site_contact_name?: string | null
                    site_contact_phone?: string | null
                    repair_item?: string | null
                    repair_notes?: string | null
                    repair_staff?: string | null
                    completed_at?: string | null
                    status?: string | null
                    workflow_state?: string | null
                    returned_reason?: string | null
                    reconciled_at?: string | null
                    metadata?: Json | null
                    created_at?: string
                    updated_at?: string
                }
                Relationships: [
                    {
                        foreignKeyName: "maintenance_reports_ticket_id_fkey"
                        columns: ["ticket_id"]
                        isOneToOne: false
                        referencedRelation: "maintenance_tickets"
                        referencedColumns: ["id"]
                    },
                    {
                        foreignKeyName: "maintenance_reports_external_ticket_id_fkey"
                        columns: ["external_ticket_id"]
                        isOneToOne: false
                        referencedRelation: "external_maintenance_tickets"
                        referencedColumns: ["id"]
                    }
                ]
            }
            maintenance_reconciliation: {
                Row: {
                    id: string
                    report_id: string | null
                    case_name: string | null
                    case_no: string | null
                    report_date: string | null
                    engineer_names: string | null
                    treatment_index: number | null
                    part_index: number | null
                    item_id: string | null
                    item_name_snapshot: string | null
                    source_bucket: string
                    qty: number
                    remark: string | null
                    status: string
                    created_at: string
                    updated_at: string
                }
                Insert: {
                    id?: string
                    report_id?: string | null
                    case_name?: string | null
                    case_no?: string | null
                    report_date?: string | null
                    engineer_names?: string | null
                    treatment_index?: number | null
                    part_index?: number | null
                    item_id?: string | null
                    item_name_snapshot?: string | null
                    source_bucket: string
                    qty?: number
                    remark?: string | null
                    status?: string
                    created_at?: string
                    updated_at?: string
                }
                Update: {
                    id?: string
                    report_id?: string | null
                    case_name?: string | null
                    case_no?: string | null
                    report_date?: string | null
                    engineer_names?: string | null
                    treatment_index?: number | null
                    part_index?: number | null
                    item_id?: string | null
                    item_name_snapshot?: string | null
                    source_bucket?: string
                    qty?: number
                    remark?: string | null
                    status?: string
                    created_at?: string
                    updated_at?: string
                }
                Relationships: [
                    {
                        foreignKeyName: "maintenance_reconciliation_report_id_fkey"
                        columns: ["report_id"]
                        isOneToOne: false
                        referencedRelation: "maintenance_reports"
                        referencedColumns: ["id"]
                    }
                ]
            }
            inventory_items: {
                Row: {
                    id: string
                    name: string
                    category: string
                    bucket: string
                    is_active: boolean | null
                    is_deleted: boolean | null
                    sort_order: number | null
                    remarks: string | null
                    created_at: string
                    updated_at: string
                }
                Insert: {
                    id?: string
                    name: string
                    category: string
                    bucket?: string
                    is_active?: boolean | null
                    is_deleted?: boolean | null
                    sort_order?: number | null
                    remarks?: string | null
                    created_at?: string
                    updated_at?: string
                }
                Update: {
                    id?: string
                    name?: string
                    category?: string
                    bucket?: string
                    is_active?: boolean | null
                    is_deleted?: boolean | null
                    sort_order?: number | null
                    remarks?: string | null
                    created_at?: string
                    updated_at?: string
                }
                Relationships: []
            }
            inventory_usage_logs: {
                Row: {
                    id: string
                    date: string
                    case_name: string | null
                    item_id: string | null
                    qty: number
                    bucket: string
                    source_bucket: string | null
                    status: string
                    report_id: string | null
                    reconciliation_id: string | null
                    treatment_name: string | null
                    treatment_index: number | null
                    part_index: number | null
                    item_name_snapshot: string | null
                    remarks: string | null
                    created_at: string
                    updated_at: string
                }
                Insert: {
                    id?: string
                    date?: string
                    case_name?: string | null
                    item_id?: string | null
                    qty: number
                    bucket?: string
                    source_bucket?: string | null
                    status?: string
                    report_id?: string | null
                    reconciliation_id?: string | null
                    treatment_name?: string | null
                    treatment_index?: number | null
                    part_index?: number | null
                    item_name_snapshot?: string | null
                    remarks?: string | null
                    created_at?: string
                    updated_at?: string
                }
                Update: {
                    id?: string
                    date?: string
                    case_name?: string | null
                    item_id?: string | null
                    qty?: number
                    bucket?: string
                    source_bucket?: string | null
                    status?: string
                    report_id?: string | null
                    reconciliation_id?: string | null
                    treatment_name?: string | null
                    treatment_index?: number | null
                    part_index?: number | null
                    item_name_snapshot?: string | null
                    remarks?: string | null
                    created_at?: string
                    updated_at?: string
                }
                Relationships: [
                    {
                        foreignKeyName: "inventory_usage_logs_item_id_fkey"
                        columns: ["item_id"]
                        isOneToOne: false
                        referencedRelation: "inventory_items"
                        referencedColumns: ["id"]
                    },
                    {
                        foreignKeyName: "inventory_usage_logs_report_id_fkey"
                        columns: ["report_id"]
                        isOneToOne: false
                        referencedRelation: "maintenance_reports"
                        referencedColumns: ["id"]
                    }
                ]
            }
            inventory_inbound_logs: {
                Row: {
                    id: string
                    item_id: string | null
                    date: string
                    qty: number
                    remarks: string | null
                    created_at: string
                    updated_at: string
                }
                Insert: {
                    id?: string
                    item_id?: string | null
                    date?: string
                    qty: number
                    remarks?: string | null
                    created_at?: string
                    updated_at?: string
                }
                Update: {
                    id?: string
                    item_id?: string | null
                    date?: string
                    qty?: number
                    remarks?: string | null
                    created_at?: string
                    updated_at?: string
                }
                Relationships: [
                    {
                        foreignKeyName: "inventory_inbound_logs_item_id_fkey"
                        columns: ["item_id"]
                        isOneToOne: false
                        referencedRelation: "inventory_items"
                        referencedColumns: ["id"]
                    }
                ]
            }
            inventory_master: {
                Row: {
                    id: string
                    category: string
                    item_model: string
                    item_name: string | null
                    initial_stock: number
                    source_sheet: string | null
                    synced_at: string
                    created_at: string
                    updated_at: string
                }
                Insert: {
                    id?: string
                    category: string
                    item_model: string
                    item_name?: string | null
                    initial_stock?: number
                    source_sheet?: string | null
                    synced_at?: string
                    created_at?: string
                    updated_at?: string
                }
                Update: {
                    id?: string
                    category?: string
                    item_model?: string
                    item_name?: string | null
                    initial_stock?: number
                    source_sheet?: string | null
                    synced_at?: string
                    created_at?: string
                    updated_at?: string
                }
                Relationships: []
            }
            inventory_movements: {
                Row: {
                    id: string
                    maintenance_report_id: string | null
                    detail_row_index: number
                    case_no: string | null
                    case_name: string | null
                    item_model: string
                    quantity: number
                    old_model: string | null
                    old_serial: string | null
                    new_serial: string | null
                    movement_type: string
                    movement_date: string | null
                    note: string | null
                    created_at: string
                    updated_at: string
                }
                Insert: {
                    id?: string
                    maintenance_report_id?: string | null
                    detail_row_index: number
                    case_no?: string | null
                    case_name?: string | null
                    item_model: string
                    quantity?: number
                    old_model?: string | null
                    old_serial?: string | null
                    new_serial?: string | null
                    movement_type: string
                    movement_date?: string | null
                    note?: string | null
                    created_at?: string
                    updated_at?: string
                }
                Update: {
                    id?: string
                    maintenance_report_id?: string | null
                    detail_row_index?: number
                    case_no?: string | null
                    case_name?: string | null
                    item_model?: string
                    quantity?: number
                    old_model?: string | null
                    old_serial?: string | null
                    new_serial?: string | null
                    movement_type?: string
                    movement_date?: string | null
                    note?: string | null
                    created_at?: string
                    updated_at?: string
                }
                Relationships: [
                    {
                        foreignKeyName: "inventory_movements_maintenance_report_id_fkey"
                        columns: ["maintenance_report_id"]
                        isOneToOne: false
                        referencedRelation: "maintenance_reports"
                        referencedColumns: ["id"]
                    }
                ]
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
export type ExternalMaintenanceTicket = Database['public']['Tables']['external_maintenance_tickets']['Row']
export type MaintenanceTicket = Database['public']['Tables']['maintenance_tickets']['Row']
export type MaintenanceReport = Database['public']['Tables']['maintenance_reports']['Row']
export type MaintenanceReconciliation = Database['public']['Tables']['maintenance_reconciliation']['Row']
export type InventoryItem = Database['public']['Tables']['inventory_items']['Row']
export type InventoryUsageLog = Database['public']['Tables']['inventory_usage_logs']['Row']
export type InventoryInboundLog = Database['public']['Tables']['inventory_inbound_logs']['Row']
export type InventoryMaster = Database['public']['Tables']['inventory_master']['Row']
export type InventoryMovement = Database['public']['Tables']['inventory_movements']['Row']
