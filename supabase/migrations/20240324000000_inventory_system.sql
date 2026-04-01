-- 1. Inventory Items Table (品項主檔)
CREATE TABLE IF NOT EXISTS public.inventory_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL UNIQUE,
    category TEXT NOT NULL, -- SE物料, 一般用料
    bucket TEXT NOT NULL,   -- 陽光庫存, SE提供
    is_active BOOLEAN DEFAULT true,
    sort_order INTEGER DEFAULT 0,
    remarks TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- 2. Inventory Monthly Data Table (每月庫存平衡)
CREATE TABLE IF NOT EXISTS public.inventory_monthly_data (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    item_id UUID REFERENCES public.inventory_items(id) ON DELETE CASCADE,
    month TEXT NOT NULL, -- YYYY-MM
    opening_qty DECIMAL DEFAULT 0,
    inbound_qty DECIMAL DEFAULT 0,
    used_qty DECIMAL DEFAULT 0,
    remarks TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(item_id, month)
);

-- 3. Inventory Usage Records Table (維運使用紀錄 / 核對紀錄)
CREATE TABLE IF NOT EXISTS public.inventory_usage_records (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    date DATE NOT NULL DEFAULT CURRENT_DATE,
    case_name TEXT,
    item_id UUID REFERENCES public.inventory_items(id) ON DELETE CASCADE,
    quantity DECIMAL NOT NULL,
    source_bucket TEXT NOT NULL, -- 陽光庫存, SE提供
    status TEXT NOT NULL DEFAULT '待確認', -- 待確認, 已確認, 已封存
    report_id UUID, -- Optional link to maintenance_reports if possible
    remarks TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- 4. Inventory Archives Table (月封存快照)
CREATE TABLE IF NOT EXISTS public.inventory_archives (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    month TEXT NOT NULL, -- YYYY-MM
    item_id UUID REFERENCES public.inventory_items(id) ON DELETE CASCADE,
    opening_qty DECIMAL NOT NULL,
    inbound_qty DECIMAL NOT NULL,
    used_qty DECIMAL NOT NULL,
    closing_qty DECIMAL NOT NULL,
    archived_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(month, item_id)
);

-- Enable RLS
ALTER TABLE public.inventory_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory_monthly_data ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory_usage_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory_archives ENABLE ROW LEVEL SECURITY;

-- Policies (Allow all for authenticated users)
CREATE POLICY "Allow all on inventory_items" ON public.inventory_items FOR ALL USING (true);
CREATE POLICY "Allow all on inventory_monthly_data" ON public.inventory_monthly_data FOR ALL USING (true);
CREATE POLICY "Allow all on inventory_usage_records" ON public.inventory_usage_records FOR ALL USING (true);
CREATE POLICY "Allow all on inventory_archives" ON public.inventory_archives FOR ALL USING (true);

-- 5. Seed Real Items for Sunshine Inventory
-- SE物料
INSERT INTO public.inventory_items (name, category, bucket, sort_order)
VALUES 
('SE3000H-RW000BEN4備機', 'SE物料', '陽光庫存', 1),
('SE3000H-TW000BEN4備機', 'SE物料', '陽光庫存', 2),
('SE5000H-RW000BEN4備機', 'SE物料', '陽光庫存', 3),
('SE5000H-TW000BEN4', 'SE物料', '陽光庫存', 4),
('SESUK-RW00INNN4', 'SE物料', '陽光庫存', 5),
('SESUK-RW00INNN4副機備機', 'SE物料', '陽光庫存', 6),
('SE82.8K-RW0P0BNY4', 'SE物料', '陽光庫存', 7),
('SE提供未入庫', 'SE物料', '陽光庫存', 8),
('S440-1GM4MRM-NA02', 'SE物料', '陽光庫存', 9),
('P401I-5RM4MRM', 'SE物料', '陽光庫存', 10),
('P500-5RM4MRM', 'SE物料', '陽光庫存', 11),
('P701-4RMLMRL', 'SE物料', '陽光庫存', 12),
('P801-4RMLMRY', 'SE物料', '陽光庫存', 13),
('P850-4RMLMRY', 'SE物料', '陽光庫存', 14),
('SE1000-GSM02-B', 'SE物料', '陽光庫存', 15),
('S1000', 'SE物料', '陽光庫存', 16),
('SE4000H', 'SE物料', '陽光庫存', 17),
('R800', 'SE物料', '陽光庫存', 18)
ON CONFLICT (name) DO UPDATE SET category = EXCLUDED.category, bucket = EXCLUDED.bucket;

-- 一般用料
INSERT INTO public.inventory_items (name, category, bucket, sort_order)
VALUES 
('PV Cable 4mm2 (DC線)', '一般用料', '陽光庫存', 101),
('Studer', '一般用料', '陽光庫存', 102),
('白鐵束帶(4.6x300mm)', '一般用料', '陽光庫存', 103),
('MC4防塵塞-母', '一般用料', '陽光庫存', 104),
('MC4防塵塞-公', '一般用料', '陽光庫存', 105),
('白鐵監控箱', '一般用料', '陽光庫存', 106),
('Router(單孔)', '一般用料', '陽光庫存', 107),
('PVC_22mm', '一般用料', '陽光庫存', 108),
('PVC_14mm', '一般用料', '陽光庫存', 109),
('PVC_8mm', '一般用料', '陽元庫存', 110),
('2"盒接', '一般用料', '陽光庫存', 111),
('鋁線槽蓋100*100', '一般用料', '陽光庫存', 112),
('鋁線槽蓋200*100', '一般用料', '陽光庫存', 113)
ON CONFLICT (name) DO UPDATE SET category = EXCLUDED.category, bucket = EXCLUDED.bucket;
