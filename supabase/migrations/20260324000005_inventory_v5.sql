-- Migration: inventory_v5
-- Path: supabase/migrations/20260324000005_inventory_v5.sql
-- Description: Add Soft Delete and Maintenance Context to Inventory

ALTER TABLE public.inventory_items ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN DEFAULT FALSE;
ALTER TABLE public.inventory_usage_logs ADD COLUMN IF NOT EXISTS treatment_name TEXT;

-- Indices for performance
CREATE INDEX IF NOT EXISTS idx_inventory_items_is_deleted ON public.inventory_items(is_deleted);
CREATE INDEX IF NOT EXISTS idx_inventory_usage_logs_report_id ON public.inventory_usage_logs(report_id);

COMMENT ON COLUMN public.inventory_items.is_deleted IS 'Soft delete flag for inventory items';
COMMENT ON COLUMN public.inventory_usage_logs.treatment_name IS 'The maintenance action context (e.g. Inverter Swap)';
