-- Migration 1: Initial schema for Y_ENG

-- 1. staff_members
CREATE TABLE IF NOT EXISTS public.staff_members (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  name text NOT NULL,
  department text NOT NULL CHECK (department IN ('工程', '專案', '業務', '結構', '行政')),
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

-- 2. vendors
CREATE TABLE IF NOT EXISTS public.vendors (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  name text NOT NULL,
  category text NOT NULL CHECK (category IN ('鋼構', '電力', '爬梯', '土木', '清洗')),
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

-- 3. flow_templates
CREATE TABLE IF NOT EXISTS public.flow_templates (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  name text NOT NULL,
  department text NOT NULL,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

-- 4. flow_template_steps
CREATE TABLE IF NOT EXISTS public.flow_template_steps (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  template_id uuid NOT NULL REFERENCES public.flow_templates(id) ON DELETE CASCADE,
  step_key text NOT NULL,
  step_name text NOT NULL,
  owner_role text,
  offset_days INTEGER,
  base_offset_days INTEGER,
  depends_on JSONB DEFAULT '[]'::jsonb,
  kw_tiers JSONB DEFAULT '[]'::jsonb,
  is_core BOOLEAN DEFAULT true,
  deliverable TEXT,
  sort_order INTEGER,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  UNIQUE(template_id, step_key)
);

-- 5. projects
CREATE TABLE IF NOT EXISTS public.projects (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  name text NOT NULL,
  kwp numeric(10,2) NOT NULL,
  engineer_id uuid REFERENCES public.staff_members(id) ON DELETE SET NULL,
  project_manager_id uuid REFERENCES public.staff_members(id) ON DELETE SET NULL,
  sales_id uuid REFERENCES public.staff_members(id) ON DELETE SET NULL,
  structure_id uuid REFERENCES public.staff_members(id) ON DELETE SET NULL,
  admin_id uuid REFERENCES public.staff_members(id) ON DELETE SET NULL,
  structure_vendor_id uuid REFERENCES public.vendors(id) ON DELETE SET NULL,
  electrical_vendor_id uuid REFERENCES public.vendors(id) ON DELETE SET NULL,
  current_step_key text,
  next_step_key text,
  projected_meter_date date,
  status_flag text,
  is_important BOOLEAN NOT NULL DEFAULT FALSE,
  is_closed BOOLEAN NOT NULL DEFAULT FALSE,
  owners JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at timestamptz DEFAULT now()
);

-- 6. project_steps
CREATE TABLE IF NOT EXISTS public.project_steps (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  template_step_key text NOT NULL,
  step_name text NOT NULL,
  owner_role text,
  sort_order integer DEFAULT 0,
  baseline_date date,
  current_planned_date date,
  actual_date date,
  status TEXT, -- e.g., '未開始', '進行中', '完成', '卡關'
  delay_reason TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at timestamptz DEFAULT now(),
  UNIQUE(project_id, template_step_key)
);

-- Basic RLS Spaces (disabled by default, will be refined in future)
ALTER TABLE public.staff_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vendors ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.flow_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.flow_template_steps ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_steps ENABLE ROW LEVEL SECURITY;

-- Allow everything for now as RLS is not fully implemented yet in app
CREATE POLICY "Allow all operations for staff_members" ON public.staff_members FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all operations for vendors" ON public.vendors FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all operations for flow_templates" ON public.flow_templates FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all operations for flow_template_steps" ON public.flow_template_steps FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all operations for projects" ON public.projects FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all operations for project_steps" ON public.project_steps FOR ALL USING (true) WITH CHECK (true);
