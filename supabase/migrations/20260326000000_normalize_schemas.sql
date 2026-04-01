-- Migration: normalize_schemas
-- Path: supabase/migrations/20260326000000_normalize_schemas.sql
-- Description: Add missing columns and migrate JSON data

-- 1. Add missing columns to maintenance_reports
ALTER TABLE public.maintenance_reports ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}'::jsonb;

-- 2. Add missing columns to inventory_usage_logs
ALTER TABLE public.inventory_usage_logs ADD COLUMN IF NOT EXISTS treatment_name TEXT;

-- 3. Add missing columns to inventory_items
ALTER TABLE public.inventory_items ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN DEFAULT FALSE;

-- 4. Indices for performance
CREATE INDEX IF NOT EXISTS idx_maintenance_reports_metadata ON public.maintenance_reports USING gin (metadata);
CREATE INDEX IF NOT EXISTS idx_inventory_usage_logs_treatment_name ON public.inventory_usage_logs(treatment_name);
CREATE INDEX IF NOT EXISTS idx_inventory_items_is_deleted ON public.inventory_items(is_deleted);

-- 5. Data Migration: Move valid JSON from repair_item to metadata
-- This only runs if metadata is empty and repair_item looks like a JSON object
UPDATE public.maintenance_reports
SET metadata = repair_item::jsonb
WHERE 
    repair_item IS NOT NULL 
    AND repair_item LIKE '{%}' 
    AND (metadata IS NULL OR metadata = '{}'::jsonb);

COMMENT ON COLUMN public.maintenance_reports.metadata IS 'Structured report metadata (treatment items, parts, photos)';
COMMENT ON COLUMN public.inventory_usage_logs.treatment_name IS 'The maintenance action context';
COMMENT ON COLUMN public.inventory_items.is_deleted IS 'Soft delete flag';
