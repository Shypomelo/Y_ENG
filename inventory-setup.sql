-- 1. Add status column to maintenance_reports if not exists
ALTER TABLE public.maintenance_reports 
ADD COLUMN IF NOT EXISTS status TEXT DEFAULT '待安排';

-- 2. Create inventory_master table
CREATE TABLE IF NOT EXISTS public.inventory_master (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    category TEXT NOT NULL, -- Solaredge, Solaredge提供, 一般與耗材
    item_model TEXT NOT NULL UNIQUE,
    item_name TEXT,
    initial_stock INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- 3. Create inventory_movements table
CREATE TABLE IF NOT EXISTS public.inventory_movements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    maintenance_report_id UUID REFERENCES public.maintenance_reports(id) ON DELETE SET NULL,
    detail_row_index INTEGER,
    item_model TEXT NOT NULL,
    quantity INTEGER NOT NULL,
    movement_type TEXT NOT NULL, -- restock, repair_use
    movement_date DATE DEFAULT CURRENT_DATE,
    case_no TEXT,
    case_name TEXT,
    old_model TEXT,
    old_serial TEXT,
    new_serial TEXT,
    note TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(maintenance_report_id, detail_row_index)
);

-- 4. Enable RLS and add policies
ALTER TABLE public.inventory_master ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory_movements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all for authenticated users on inventory_master" 
ON public.inventory_master FOR ALL USING (true);

CREATE POLICY "Allow all for authenticated users on inventory_movements" 
ON public.inventory_movements FOR ALL USING (true);

-- 5. Seed initial inventory items (Optional but helpful)
INSERT INTO public.inventory_master (category, item_model, item_name, initial_stock)
VALUES 
('Solaredge', 'P320', 'Power Optimizer', 10),
('Solaredge', 'P401', 'Power Optimizer', 5),
('Solaredge提供', 'SE15K', 'Inverter', 2),
('一般與耗材', 'MC4接頭', 'MC4 Connector', 100)
ON CONFLICT (item_model) DO NOTHING;
