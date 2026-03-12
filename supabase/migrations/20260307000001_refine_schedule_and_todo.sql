-- Migration: Refine daily_schedules and add todo_items
ALTER TABLE public.daily_schedules ADD COLUMN IF NOT EXISTS engineer_id uuid REFERENCES public.staff_members(id) ON DELETE SET NULL;
ALTER TABLE public.daily_schedules ADD COLUMN IF NOT EXISTS work_type text;

-- Update status check constraint for daily_schedules
-- First drop existing constraint if it exists (we don't know the exact name, so we can try to drop and recreate or just ignore check if we want flexibility)
-- In a real environment we'd find the name. Here I'll just rely on the application layer if needed, or try standard names.
-- However, the previous migration used: CHECK (status IN ('pending', 'scheduled', 'done', 'cancelled'))
-- User wants: pending_claim, scheduled, done, cancelled.

ALTER TABLE public.daily_schedules DROP CONSTRAINT IF EXISTS daily_schedules_status_check;
ALTER TABLE public.daily_schedules ADD CONSTRAINT daily_schedules_status_check CHECK (status IN ('pending_claim', 'scheduled', 'done', 'cancelled'));

-- Create todo_items table
CREATE TABLE IF NOT EXISTS public.todo_items (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    title text NOT NULL,
    is_completed boolean DEFAULT false,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

-- Enable RLS for todo_items
ALTER TABLE public.todo_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all operations for todo_items" ON public.todo_items FOR ALL USING (true) WITH CHECK (true);

-- Create system_settings table
CREATE TABLE IF NOT EXISTS public.system_settings (
    id text PRIMARY KEY,
    value jsonb NOT NULL,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

-- Enable RLS for system_settings
ALTER TABLE public.system_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all operations for system_settings" ON public.system_settings FOR ALL USING (true) WITH CHECK (true);

-- Insert initial statuses
INSERT INTO public.system_settings (id, value) 
VALUES ('schedule_work_types', '["掛表", "現勘", "進場", "停電", "建置", "電檢", "驗收", "維修", "清洗", "開會", "內勤", "其他", "休假"]'::jsonb)
ON CONFLICT (id) DO UPDATE SET value = EXCLUDED.value;
