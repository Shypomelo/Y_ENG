-- Migration: Add Google Calendar Sync and Time fields to daily_schedules

-- 1. Add fields to daily_schedules
ALTER TABLE public.daily_schedules 
ADD COLUMN IF NOT EXISTS start_datetime timestamp with time zone,
ADD COLUMN IF NOT EXISTS end_datetime timestamp with time zone,
ADD COLUMN IF NOT EXISTS is_all_day boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS source text DEFAULT 'internal',
ADD COLUMN IF NOT EXISTS google_event_id text,
ADD COLUMN IF NOT EXISTS google_calendar_id text,
ADD COLUMN IF NOT EXISTS sync_status text DEFAULT 'pending',
ADD COLUMN IF NOT EXISTS last_synced_at timestamp with time zone;

-- Add a unique constraint on google_event_id if it's not null, 
-- to prevent duplicate syncs. We can use a partial index for this in Postgres.
CREATE UNIQUE INDEX IF NOT EXISTS idx_daily_schedules_google_event_id ON public.daily_schedules(google_event_id) WHERE google_event_id IS NOT NULL;

-- 2. Create google_calendar_settings table
CREATE TABLE IF NOT EXISTS public.google_calendar_settings (
    id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    calendar_id text,
    calendar_name text,
    sync_enabled boolean DEFAULT false,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);

-- Enable RLS for the new table
ALTER TABLE public.google_calendar_settings ENABLE ROW LEVEL SECURITY;

-- Add RLS policy for the settings table
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'google_calendar_settings' 
        AND policyname = 'Allow all operations for google_calendar_settings'
    ) THEN
        CREATE POLICY "Allow all operations for google_calendar_settings" 
        ON public.google_calendar_settings 
        FOR ALL 
        USING (true) 
        WITH CHECK (true);
    END IF;
END
$$;

-- Seed an initial empty settings row if the table is empty
INSERT INTO public.google_calendar_settings (calendar_id, calendar_name, sync_enabled)
SELECT null, null, false
WHERE NOT EXISTS (SELECT 1 FROM public.google_calendar_settings);

-- Force PostgREST schema cache reload
NOTIFY pgrst, 'reload schema';
