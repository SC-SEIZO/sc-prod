-- WARNING: This schema is for context only and is not meant to be run.
-- Table order and constraints may not be valid for execution.

CREATE TABLE public.locations (
  id text NOT NULL,
  name text NOT NULL,
  CONSTRAINT locations_pkey PRIMARY KEY (id)
);
CREATE TABLE public.users (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  uid text NOT NULL UNIQUE,
  email text NOT NULL UNIQUE,
  role text NOT NULL CHECK (role = ANY (ARRAY['admin'::text, 'manager'::text, 'staff'::text, 'editor'::text, 'viewer'::text])),
  name text,
  photo_url text,
  created_at timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
  CONSTRAINT users_pkey PRIMARY KEY (id)
);
CREATE TABLE public.materials (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  sku text NOT NULL UNIQUE,
  name text NOT NULL,
  description text,
  category text NOT NULL,
  unit text NOT NULL,
  source text,
  min_threshold numeric NOT NULL DEFAULT 0,
  current_stock numeric NOT NULL DEFAULT 0,
  avg_usage_per_day numeric NOT NULL DEFAULT 0,
  monthly_volume numeric NOT NULL DEFAULT 0,
  expiry_date timestamp with time zone,
  incoming_plan jsonb NOT NULL DEFAULT '[]'::jsonb,
  hidden boolean NOT NULL DEFAULT false,
  updated_at timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
  CONSTRAINT materials_pkey PRIMARY KEY (id)
);
CREATE TABLE public.parts (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  material_id uuid NOT NULL,
  part_number_level1 text,
  part_number_injection text,
  part_name text NOT NULL,
  model text,
  part_weight numeric NOT NULL DEFAULT 0,
  updated_at timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
  CONSTRAINT parts_pkey PRIMARY KEY (id),
  CONSTRAINT parts_material_id_fkey FOREIGN KEY (material_id) REFERENCES public.materials(id)
);
CREATE TABLE public.usage_plans (
  id text NOT NULL,
  month integer NOT NULL,
  year integer NOT NULL,
  multipliers jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
  CONSTRAINT usage_plans_pkey PRIMARY KEY (id)
);
CREATE TABLE public.transactions (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  material_id uuid NOT NULL,
  location_id text NOT NULL,
  type text NOT NULL CHECK (type = ANY (ARRAY['in'::text, 'out'::text, 'adjustment'::text])),
  quantity numeric NOT NULL,
  user_id text NOT NULL,
  timestamp timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
  notes text,
  CONSTRAINT transactions_pkey PRIMARY KEY (id),
  CONSTRAINT transactions_material_id_fkey FOREIGN KEY (material_id) REFERENCES public.materials(id),
  CONSTRAINT transactions_location_id_fkey FOREIGN KEY (location_id) REFERENCES public.locations(id)
);
CREATE TABLE public.inventory_levels (
  material_id uuid NOT NULL,
  location_id text NOT NULL,
  quantity numeric NOT NULL DEFAULT 0,
  updated_at timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
  CONSTRAINT inventory_levels_pkey PRIMARY KEY (material_id, location_id),
  CONSTRAINT inventory_levels_material_id_fkey FOREIGN KEY (material_id) REFERENCES public.materials(id),
  CONSTRAINT inventory_levels_location_id_fkey FOREIGN KEY (location_id) REFERENCES public.locations(id)
);
CREATE TABLE public.alerts (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  material_id uuid NOT NULL,
  type text NOT NULL CHECK (type = ANY (ARRAY['low_stock'::text, 'expired'::text])),
  message text NOT NULL,
  status text NOT NULL CHECK (status = ANY (ARRAY['unread'::text, 'read'::text, 'resolved'::text])),
  timestamp timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
  CONSTRAINT alerts_pkey PRIMARY KEY (id),
  CONSTRAINT alerts_material_id_fkey FOREIGN KEY (material_id) REFERENCES public.materials(id)
);
CREATE TABLE public.master_parts (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  part_number text NOT NULL UNIQUE,
  part_name text,
  home_line text,
  backup_line text,
  model text,
  cycle_time numeric,
  sebango text,
  material text,
  area text,
  tonnage text,
  cavity numeric DEFAULT 1,
  mold text DEFAULT 'MOLD-01'::text,
  weight numeric DEFAULT 0,
  spec numeric DEFAULT 1,
  process text DEFAULT 'injection'::text,
  shikake numeric DEFAULT 2,
  customer text,
  customer_pno text,
  customer_sebango text,
  seq_no integer,
  daily_requirement_n numeric DEFAULT 0,
  daily_requirement_n1 numeric DEFAULT 0,
  daily_requirement_n2 numeric DEFAULT 0,
  daily_requirement_n3 numeric DEFAULT 0,
  month_n_forecast numeric DEFAULT 0,
  month_n1_forecast numeric DEFAULT 0,
  month_n2_forecast numeric DEFAULT 0,
  month_n3_forecast numeric DEFAULT 0,
  monthly_forecasts jsonb DEFAULT '{}'::jsonb,
  created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT master_parts_pkey PRIMARY KEY (id)
);
CREATE TABLE public.order_conversions (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  cust_part_number text NOT NULL,
  cust_sebango text DEFAULT 'CUST-SEB'::text,
  prod_sebango text NOT NULL,
  part_category text DEFAULT 'big'::text CHECK (part_category = ANY (ARRAY['big'::text, 'small'::text])),
  created_at timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
  CONSTRAINT order_conversions_pkey PRIMARY KEY (id)
);
CREATE TABLE public.production_plans (
  id text NOT NULL,
  plan_type text NOT NULL,
  machine_id text NOT NULL,
  date_key text NOT NULL,
  jobs jsonb NOT NULL DEFAULT '[]'::jsonb,
  day_ot text DEFAULT 'teiji'::text,
  night_ot text DEFAULT 'teiji'::text,
  is_abnormal boolean DEFAULT false,
  abnormal_type text,
  abnormal_start text,
  is_ng boolean DEFAULT false,
  ng_type text,
  ng_start text,
  logs jsonb DEFAULT '[]'::jsonb,
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT production_plans_pkey PRIMARY KEY (id)
);
CREATE TABLE public.label_counters (
  date_key text NOT NULL,
  seq integer NOT NULL DEFAULT 0,
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT label_counters_pkey PRIMARY KEY (date_key)
);
CREATE TABLE public.leaders (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  name text NOT NULL,
  pin text UNIQUE,
  created_at timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
  pin_hash text,
  pin_encrypted text,
  CONSTRAINT leaders_pkey PRIMARY KEY (id)
);
CREATE TABLE public.history_orders (
  id bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
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
  daily_requirement_n3 numeric DEFAULT 0,
  CONSTRAINT history_orders_pkey PRIMARY KEY (id)
);