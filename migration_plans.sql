-- ==========================================================
-- SUPABASE MIGRATION FOR PATTERNS & PERSISTENT PLAN STORAGE
-- Run these statements in the Supabase SQL Editor
-- ==========================================================

-- 1. Create production_plans table if it does not exist
CREATE TABLE IF NOT EXISTS public.production_plans (
    id text PRIMARY KEY, -- Key format: 'YYYY-MM-DD_MachineID' (daily) or 'YYYY-MM_avg_MachineID' (average)
    plan_type text NOT NULL, -- 'daily' or 'avg'
    machine_id text NOT NULL,
    date_key text NOT NULL, -- YYYY-MM-DD or YYYY-MM
    jobs jsonb NOT NULL DEFAULT '[]'::jsonb,
    day_ot text DEFAULT 'teiji',
    night_ot text DEFAULT 'teiji',
    is_abnormal boolean DEFAULT false,
    abnormal_type text,
    abnormal_start text,
    logs jsonb DEFAULT '[]'::jsonb,
    updated_at timestamp with time zone DEFAULT now()
);

-- ALTER TABLE statement to add new columns if table already exists
ALTER TABLE public.production_plans 
ADD COLUMN IF NOT EXISTS is_abnormal boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS abnormal_type text,
ADD COLUMN IF NOT EXISTS abnormal_start text,
ADD COLUMN IF NOT EXISTS logs jsonb DEFAULT '[]'::jsonb;

-- 2. Enable Row-Level Security (RLS) on production_plans
ALTER TABLE public.production_plans ENABLE ROW LEVEL SECURITY;

-- 3. Drop existing policies if any
DROP POLICY IF EXISTS "Allow anonymous read access" ON public.production_plans;
DROP POLICY IF EXISTS "Allow anonymous insert access" ON public.production_plans;
DROP POLICY IF EXISTS "Allow anonymous update access" ON public.production_plans;
DROP POLICY IF EXISTS "Allow anonymous delete access" ON public.production_plans;

-- 4. Create policies to allow client-side anonymous access
CREATE POLICY "Allow anonymous read access" ON public.production_plans
    FOR SELECT USING (true);

CREATE POLICY "Allow anonymous insert access" ON public.production_plans
    FOR INSERT WITH CHECK (true);

CREATE POLICY "Allow anonymous update access" ON public.production_plans
    FOR UPDATE USING (true) WITH CHECK (true);

CREATE POLICY "Allow anonymous delete access" ON public.production_plans
    FOR DELETE USING (true);

-- 5. Grant all permissions on production_plans to anon, authenticated, and service_role
GRANT ALL ON public.production_plans TO anon, authenticated, service_role;
