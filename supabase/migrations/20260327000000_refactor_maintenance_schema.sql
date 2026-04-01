-- Migration: Refactor Maintenance and Inventory Schema
-- Path: supabase/migrations/20260327000000_refactor_maintenance_schema.sql

-- 1. Add workflow columns to maintenance_reports
ALTER TABLE public.maintenance_reports ADD COLUMN IF NOT EXISTS workflow_state TEXT DEFAULT 'draft';
ALTER TABLE public.maintenance_reports ADD COLUMN IF NOT EXISTS returned_reason TEXT;
ALTER TABLE public.maintenance_reports ADD COLUMN IF NOT EXISTS reconciled_at TIMESTAMPTZ;

-- 2. Create maintenance_reconciliation table
CREATE TABLE IF NOT EXISTS public.maintenance_reconciliation (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    report_id UUID REFERENCES public.maintenance_reports(id) ON DELETE CASCADE,
    case_name TEXT,
    case_no TEXT,
    report_date DATE,
    engineer_names TEXT,
    treatment_index INTEGER, -- Index in treatment_items array
    part_index INTEGER,      -- Index in parts array within treatment
    item_id UUID REFERENCES public.inventory_items(id) ON DELETE SET NULL,
    item_name_snapshot TEXT,
    source_bucket TEXT NOT NULL, -- '陽光庫存' | 'SE提供'
    qty DECIMAL NOT NULL DEFAULT 1,
    remark TEXT,
    status TEXT NOT NULL DEFAULT 'pending', -- 'pending' | 'returned' | 'confirmed'
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- 3. Enhance inventory_usage_logs for consistency
ALTER TABLE public.inventory_usage_logs ADD COLUMN IF NOT EXISTS source_bucket TEXT;
ALTER TABLE public.inventory_usage_logs ADD COLUMN IF NOT EXISTS reconciliation_id UUID REFERENCES public.maintenance_reconciliation(id) ON DELETE SET NULL;
ALTER TABLE public.inventory_usage_logs ADD COLUMN IF NOT EXISTS item_name_snapshot TEXT;

-- 4. Indices for new table
CREATE INDEX IF NOT EXISTS idx_maintenance_reconciliation_report_id ON public.maintenance_reconciliation(report_id);
CREATE INDEX IF NOT EXISTS idx_maintenance_reconciliation_status ON public.maintenance_reconciliation(status);

-- 5. Comments
COMMENT ON COLUMN public.maintenance_reports.workflow_state IS 'Workflow lifecycle: draft, saved, pending_reconciliation, returned, confirmed';
COMMENT ON TABLE public.maintenance_reconciliation IS 'Temporary storage for maintenance parts awaiting verification';

-- 6. Enable RLS
ALTER TABLE public.maintenance_reconciliation ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all on maintenance_reconciliation" ON public.maintenance_reconciliation FOR ALL USING (true);

NOTIFY pgrst, 'reload schema';
