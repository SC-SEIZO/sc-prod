-- ==========================================================
-- MIGRATION: label_counters table + NG columns for production_plans
-- Run these statements in the Supabase SQL Editor
-- Date: 2026-06-22
-- ==========================================================

-- 1. Add NG state columns to production_plans (if not already present)
ALTER TABLE public.production_plans
ADD COLUMN IF NOT EXISTS is_ng boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS ng_type text,
ADD COLUMN IF NOT EXISTS ng_start text;

-- 2. Create label_counters table for cross-device label sequence tracking
CREATE TABLE IF NOT EXISTS public.label_counters (
    date_key text PRIMARY KEY,  -- Format: YYYY-MM-DD (one counter per day)
    seq integer NOT NULL DEFAULT 0,
    updated_at timestamp with time zone DEFAULT now()
);

-- 3. Enable Row-Level Security on label_counters
ALTER TABLE public.label_counters ENABLE ROW LEVEL SECURITY;

-- 4. Drop existing policies if any
DROP POLICY IF EXISTS "Allow anonymous read on label_counters" ON public.label_counters;
DROP POLICY IF EXISTS "Allow anonymous insert on label_counters" ON public.label_counters;
DROP POLICY IF EXISTS "Allow anonymous update on label_counters" ON public.label_counters;

-- 5. Create permissive policies (same pattern as production_plans)
CREATE POLICY "Allow anonymous read on label_counters" ON public.label_counters
    FOR SELECT USING (true);

CREATE POLICY "Allow anonymous insert on label_counters" ON public.label_counters
    FOR INSERT WITH CHECK (true);

CREATE POLICY "Allow anonymous update on label_counters" ON public.label_counters
    FOR UPDATE USING (true) WITH CHECK (true);

-- 6. Grant permissions
GRANT ALL ON public.label_counters TO anon, authenticated, service_role;
