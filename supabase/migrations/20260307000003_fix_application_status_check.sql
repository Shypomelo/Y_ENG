-- Migration: Add 'application' to daily_schedules status check
DO $$ 
BEGIN
    ALTER TABLE public.daily_schedules DROP CONSTRAINT IF EXISTS daily_schedules_status_check;
    ALTER TABLE public.daily_schedules ADD CONSTRAINT daily_schedules_status_check CHECK (status IN ('pending_claim', 'scheduled', 'done', 'cancelled', 'application'));
END $$;
