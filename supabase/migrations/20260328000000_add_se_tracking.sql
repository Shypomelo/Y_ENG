-- Migration: Add SE Inventory Tracking Table
-- Date: 2026-03-28

CREATE TABLE IF NOT EXISTS public.se_inventory_tracking (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    case_name text,
    old_model text,
    old_sn text,
    fault_reason text,
    new_sn text,
    receive_method text,
    received_at timestamptz,
    replacement_date date, -- Empty = Pending/Not Used, Not Empty = Replaced/Completed
    remarks text,
    report_id uuid REFERENCES public.maintenance_reports(id) ON DELETE SET NULL,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.se_inventory_tracking ENABLE ROW LEVEL SECURITY;

-- Policy
CREATE POLICY "Allow all operations for se_inventory_tracking" ON public.se_inventory_tracking FOR ALL USING (true) WITH CHECK (true);

-- Index for searching
CREATE INDEX IF NOT EXISTS idx_se_tracking_report ON public.se_inventory_tracking(report_id);
CREATE INDEX IF NOT EXISTS idx_se_tracking_case ON public.se_inventory_tracking(case_name);

NOTIFY pgrst, 'reload schema';
