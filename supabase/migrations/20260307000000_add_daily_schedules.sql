-- Migration: Add daily_schedules table
CREATE TABLE IF NOT EXISTS public.daily_schedules (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    title text NOT NULL,
    schedule_date date NOT NULL,
    start_time time WITHOUT TIME ZONE,
    end_time time WITHOUT TIME ZONE,
    assignee_ids uuid[] DEFAULT '{}'::uuid[],
    project_id uuid REFERENCES public.projects(id) ON DELETE SET NULL,
    description text,
    status text DEFAULT 'pending' CHECK (status IN ('pending', 'scheduled', 'done', 'cancelled')),
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.daily_schedules ENABLE ROW LEVEL SECURITY;

-- Allow all operations for now (following project pattern)
CREATE POLICY "Allow all operations for daily_schedules" ON public.daily_schedules FOR ALL USING (true) WITH CHECK (true);
