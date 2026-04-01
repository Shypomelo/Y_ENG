-- Migration: Add Maintenance Tables and Project Contact Fields

-- 1. Add contact fields to projects
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name='projects' AND column_name='site_contact_name') THEN
        ALTER TABLE public.projects ADD COLUMN site_contact_name text;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name='projects' AND column_name='site_contact_phone') THEN
        ALTER TABLE public.projects ADD COLUMN site_contact_phone text;
    END IF;
END $$;

-- 2. Create maintenance_tickets (Pending Maintenance)
CREATE TABLE IF NOT EXISTS public.maintenance_tickets (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    project_id uuid REFERENCES public.projects(id) ON DELETE SET NULL,
    case_no text,
    case_name text NOT NULL,
    region text,
    report_time timestamptz DEFAULT now(),
    issue_summary text,
    status text DEFAULT '待處理',
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

-- 3. Create maintenance_reports (Maintenance Reports)
CREATE TABLE IF NOT EXISTS public.maintenance_reports (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    ticket_id uuid REFERENCES public.maintenance_tickets(id) ON DELETE SET NULL,
    case_no text,
    case_name text NOT NULL,
    address text,
    site_contact_name text,
    site_contact_phone text,
    repair_item text,
    repair_notes text,
    repair_staff text, 
    completed_at timestamptz,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

-- 4. Enable RLS
ALTER TABLE public.maintenance_tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.maintenance_reports ENABLE ROW LEVEL SECURITY;

-- 5. Allow all operations for now
CREATE POLICY "Allow all operations for maintenance_tickets" ON public.maintenance_tickets FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all operations for maintenance_reports" ON public.maintenance_reports FOR ALL USING (true) WITH CHECK (true);

-- 6. Notify PostgREST
NOTIFY pgrst, 'reload schema';
