-- Migration: add_reconciliation_indices
-- Path: supabase/migrations/20260326000001_add_reconciliation_indices.sql

ALTER TABLE public.inventory_usage_logs ADD COLUMN IF NOT EXISTS treatment_index INTEGER;
ALTER TABLE public.inventory_usage_logs ADD COLUMN IF NOT EXISTS part_index INTEGER;

CREATE INDEX IF NOT EXISTS idx_inventory_usage_logs_recon_composite ON public.inventory_usage_logs(report_id, treatment_index, part_index);

COMMENT ON COLUMN public.inventory_usage_logs.treatment_index IS 'Index of the treatment within the maintenance report';
COMMENT ON COLUMN public.inventory_usage_logs.part_index IS 'Index of the part within the treatment';
