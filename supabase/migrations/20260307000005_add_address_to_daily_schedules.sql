-- Migration: Add address column to daily_schedules
ALTER TABLE public.daily_schedules ADD COLUMN IF NOT EXISTS address text;
