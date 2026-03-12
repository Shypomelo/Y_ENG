-- Migration: Align daily_schedules schema with application payload
-- This script is idempotent and can be run multiple times safely.

DO $$ 
BEGIN
    -- 1. Ensure 'title' column exists (it might be missing if the very first migration failed partially)
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name='daily_schedules' AND column_name='title') THEN
        ALTER TABLE public.daily_schedules ADD COLUMN title text NOT NULL DEFAULT '未命名排程';
    END IF;

    -- 2. Ensure 'engineer_id' column exists (references staff_members)
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name='daily_schedules' AND column_name='engineer_id') THEN
        ALTER TABLE public.daily_schedules ADD COLUMN engineer_id uuid REFERENCES public.staff_members(id) ON DELETE SET NULL;
    END IF;

    -- 3. Ensure 'work_type' column exists (for案件狀態)
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name='daily_schedules' AND column_name='work_type') THEN
        ALTER TABLE public.daily_schedules ADD COLUMN work_type text;
    END IF;

    -- 4. Update 'status' check constraint to match application states
    -- We drop the existing constraint first to ensure we apply the latest list
    ALTER TABLE public.daily_schedules DROP CONSTRAINT IF EXISTS daily_schedules_status_check;
    ALTER TABLE public.daily_schedules ADD CONSTRAINT daily_schedules_status_check CHECK (status IN ('pending_claim', 'scheduled', 'done', 'cancelled'));

    -- 5. Ensure 'assignee_ids' is uuid[]
    -- Most migrations create it as uuid[], but let's be sure. 
    -- If it exists as text[] or something else, we don't necessarily want to force cast here unless we know it's wrong.
    -- Assuming first migration used: assignee_ids uuid[] DEFAULT '{}'::uuid[]

    -- 6. Enable RLS and verify policies
    ALTER TABLE public.daily_schedules ENABLE ROW LEVEL SECURITY;
    
    -- Drop and recreate the 'Allow all' policy to be sure it's correct
    DROP POLICY IF EXISTS "Allow all operations for daily_schedules" ON public.daily_schedules;
    CREATE POLICY "Allow all operations for daily_schedules" ON public.daily_schedules 
    FOR ALL USING (true) WITH CHECK (true);

    -- 7. Notify PostgREST to reload schema
    NOTIFY pgrst, 'reload schema';
END $$;
