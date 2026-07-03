-- ==========================================
-- SUPABASE MIGRATION FOR MONTHLY FORECASTS & HISTORY
-- Run these statements in the Supabase SQL Editor
-- ==========================================

-- 1. Add forecast volume and daily requirement columns to public.master_parts table if they do not exist
ALTER TABLE public.master_parts 
ADD COLUMN IF NOT EXISTS daily_requirement_n numeric DEFAULT 0,
ADD COLUMN IF NOT EXISTS daily_requirement_n1 numeric DEFAULT 0,
ADD COLUMN IF NOT EXISTS daily_requirement_n2 numeric DEFAULT 0,
ADD COLUMN IF NOT EXISTS daily_requirement_n3 numeric DEFAULT 0,
ADD COLUMN IF NOT EXISTS month_n_forecast numeric DEFAULT 0,
ADD COLUMN IF NOT EXISTS month_n1_forecast numeric DEFAULT 0,
ADD COLUMN IF NOT EXISTS month_n2_forecast numeric DEFAULT 0,
ADD COLUMN IF NOT EXISTS month_n3_forecast numeric DEFAULT 0;

-- 2. Add JSONB column for dynamic monthly rollover forecasts mapped to calendar month/year keys (e.g. '2026-06')
ALTER TABLE public.master_parts
ADD COLUMN IF NOT EXISTS monthly_forecasts jsonb DEFAULT '{}'::jsonb;

-- Comment on master_parts columns
COMMENT ON COLUMN public.master_parts.daily_requirement_n IS 'Month N average daily requirements volume';
COMMENT ON COLUMN public.master_parts.daily_requirement_n1 IS 'Month N+1 average daily requirements volume';
COMMENT ON COLUMN public.master_parts.daily_requirement_n2 IS 'Month N+2 average daily requirements volume';
COMMENT ON COLUMN public.master_parts.daily_requirement_n3 IS 'Month N+3 average daily requirements volume';
COMMENT ON COLUMN public.master_parts.month_n_forecast IS 'Month N total forecast volume';
COMMENT ON COLUMN public.master_parts.month_n1_forecast IS 'Month N+1 total forecast volume';
COMMENT ON COLUMN public.master_parts.month_n2_forecast IS 'Month N+2 total forecast volume';
COMMENT ON COLUMN public.master_parts.month_n3_forecast IS 'Month N+3 total forecast volume';
COMMENT ON COLUMN public.master_parts.monthly_forecasts IS 'JSON object of historical and future forecast values keyed by YYYY-MM';

-- 3. Create history_orders table for storing forecast upload snapshots
CREATE TABLE IF NOT EXISTS public.history_orders (
    id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    batch_id text NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    sebango text,
    part_number text,
    part_name text,
    month_n_volume numeric DEFAULT 0,
    month_n1_volume numeric DEFAULT 0,
    month_n2_volume numeric DEFAULT 0,
    month_n3_volume numeric DEFAULT 0,
    daily_requirement_n numeric DEFAULT 0,
    daily_requirement_n1 numeric DEFAULT 0,
    daily_requirement_n2 numeric DEFAULT 0,
    daily_requirement_n3 numeric DEFAULT 0
);

-- Enable row-level security (RLS) on history_orders
ALTER TABLE public.history_orders ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if any, then recreate
DROP POLICY IF EXISTS "Allow anonymous read access" ON public.history_orders;
DROP POLICY IF EXISTS "Allow anonymous write access" ON public.history_orders;

-- Create policies to allow client-side anonymous access
CREATE POLICY "Allow anonymous read access" ON public.history_orders
    FOR SELECT USING (true);

CREATE POLICY "Allow anonymous write access" ON public.history_orders
    FOR INSERT WITH CHECK (true);

-- Grant all permissions on history_orders to anon, authenticated, and service_role
GRANT ALL ON public.history_orders TO anon, authenticated, service_role;
