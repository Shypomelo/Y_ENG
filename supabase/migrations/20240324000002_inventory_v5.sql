-- 1. Add Soft Delete support to Inventory Items
ALTER TABLE public.inventory_items ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN DEFAULT FALSE;

-- 2. Add Treatment Item context to Usage Logs
ALTER TABLE public.inventory_usage_logs ADD COLUMN IF NOT EXISTS treatment_name TEXT;

-- 3. Ensure index for performance
CREATE INDEX IF NOT EXISTS idx_inventory_items_is_deleted ON public.inventory_items(is_deleted);
CREATE INDEX IF NOT EXISTS idx_inventory_usage_logs_report_id ON public.inventory_usage_logs(report_id);
