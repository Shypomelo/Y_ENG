-- 1. Create Inventory Adjustment Logs Table
CREATE TABLE IF NOT EXISTS public.inventory_adjustment_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    item_id UUID REFERENCES public.inventory_items(id) ON DELETE CASCADE,
    date DATE NOT NULL DEFAULT CURRENT_DATE,
    qty DECIMAL NOT NULL, -- Positive for addition, negative for deduction
    reason TEXT NOT NULL, -- 補登入庫, 盤點修正, 報廢, 其他修正
    remarks TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- 2. Add RLS
ALTER TABLE public.inventory_adjustment_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all on adjustment_logs" ON public.inventory_adjustment_logs FOR ALL USING (true);

-- 3. Add is_deleted to inventory_items if it doesn't exist (support soft delete)
-- Checking for existence is handled by the migration flow, but adding it here for completeness
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME='inventory_items' AND COLUMN_NAME='is_deleted') THEN
        ALTER TABLE public.inventory_items ADD COLUMN is_deleted BOOLEAN DEFAULT false;
    END IF;
END $$;
