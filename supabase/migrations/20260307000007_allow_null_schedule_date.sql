-- Migration: Allow null schedule_date for daily_schedules
ALTER TABLE public.daily_schedules ALTER COLUMN schedule_date DROP NOT NULL;
