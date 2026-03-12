-- Migration: Finalize Field Names (case_name, case_type, address)
-- This script ensures the daily_schedules table uses the canonical field names requested.

DO $$ 
BEGIN
    -- 1. Rename 'title' to 'case_name' if exists
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name='daily_schedules' AND column_name='title') 
       AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name='daily_schedules' AND column_name='case_name') THEN
        ALTER TABLE public.daily_schedules RENAME COLUMN title TO case_name;
    ELSIF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name='daily_schedules' AND column_name='case_name') THEN
        ALTER TABLE public.daily_schedules ADD COLUMN case_name text NOT NULL DEFAULT '未命名案件';
    END IF;

    -- 2. Rename 'work_type' to 'case_type' if exists
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name='daily_schedules' AND column_name='work_type') 
       AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name='daily_schedules' AND column_name='case_type') THEN
        ALTER TABLE public.daily_schedules RENAME COLUMN work_type TO case_type;
    ELSIF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name='daily_schedules' AND column_name='case_type') THEN
        ALTER TABLE public.daily_schedules ADD COLUMN case_type text;
    END IF;

    -- 3. Ensure 'address' column exists
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name='daily_schedules' AND column_name='address') THEN
        ALTER TABLE public.daily_schedules ADD COLUMN address text;
    END IF;

    -- 4. Notify PostgREST to reload schema
    NOTIFY pgrst, 'reload schema';
END $$;
