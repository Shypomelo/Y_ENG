-- Migration: Add Inventory Tables and Update Maintenance Reports
-- Date: 2026-03-24

-- 1. Create inventory_master
CREATE TABLE IF NOT EXISTS public.inventory_master (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    category text NOT NULL, -- Solaredge, Solaredge提供, 一般與耗材
    item_model text NOT NULL UNIQUE,
    item_name text,
    initial_stock int DEFAULT 0,
    source_sheet text,
    synced_at timestamptz DEFAULT now(),
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

-- 2. Create inventory_movements
CREATE TABLE IF NOT EXISTS public.inventory_movements (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    maintenance_report_id uuid REFERENCES public.maintenance_reports(id) ON DELETE CASCADE,
    detail_row_index int NOT NULL, -- Used to prevent duplicate deductions from same report
    case_no text,
    case_name text,
    item_model text NOT NULL,
    quantity int NOT NULL DEFAULT 1,
    old_model text,
    old_serial text,
    new_serial text,
    movement_type text NOT NULL, -- 'repair_use', 'restock', etc.
    movement_date date DEFAULT CURRENT_DATE,
    note text,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now(),
    -- Unique constraint to prevent double-dipping
    UNIQUE(maintenance_report_id, detail_row_index)
);

-- 3. Add status to maintenance_reports
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name='maintenance_reports' AND column_name='status') THEN
        ALTER TABLE public.maintenance_reports ADD COLUMN status text DEFAULT '待安排';
    END IF;
END $$;

-- 4. Enable RLS
ALTER TABLE public.inventory_master ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory_movements ENABLE ROW LEVEL SECURITY;

-- 5. Policies
CREATE POLICY "Allow all operations for inventory_master" ON public.inventory_master FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all operations for inventory_movements" ON public.inventory_movements FOR ALL USING (true) WITH CHECK (true);

-- 6. Insert some seed data for inventory_master (to make it not 0)
INSERT INTO public.inventory_master (category, item_model, item_name, initial_stock)
VALUES 
    ('Solaredge', 'SE10K-RWS', '10K 三相變流器', 5),
    ('Solaredge', 'P401', '優化器 P401', 50),
    ('Solaredge', 'P505', '優化器 P505', 30),
    ('一般與耗材', 'MC4 Connector', 'MC4 接頭', 100)
ON CONFLICT (item_model) DO NOTHING;

NOTIFY pgrst, 'reload schema';
