-- ============================================================================
-- Leader PIN Security Migration
-- Run this in your Supabase SQL Editor.
--
-- After this migration:
--   * pin_hash      stores a scrypt hash (used by the server to verify PINs)
--   * pin_encrypted stores an AES-256-GCM ciphertext (decrypted server-side
--     so planners can still view PINs in the Leader Registry)
--   * the plaintext `pin` column becomes nullable; the app server will
--     automatically hash + encrypt existing plaintext PINs on first use and
--     blank the plaintext value.
--   * Row Level Security locks the table so browser clients (anon key) can
--     no longer read PINs directly. Only the app server, using
--     SUPABASE_SERVICE_ROLE_KEY, can access this table.
--
-- IMPORTANT: set SUPABASE_SERVICE_ROLE_KEY and PIN_ENCRYPTION_KEY in the
-- server .env BEFORE running the RLS section, otherwise leader login stops
-- working (the anon key will be locked out by design).
-- ============================================================================

-- 1. New columns
ALTER TABLE public.leaders ADD COLUMN IF NOT EXISTS pin_hash text;
ALTER TABLE public.leaders ADD COLUMN IF NOT EXISTS pin_encrypted text;

-- 2. Plaintext pin becomes optional (will be blanked by the server migration)
ALTER TABLE public.leaders ALTER COLUMN pin DROP NOT NULL;

-- 3. Lock the table away from browser clients
ALTER TABLE public.leaders ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow public read access" ON public.leaders;
DROP POLICY IF EXISTS "Allow public write" ON public.leaders;
-- No anon policies are recreated on purpose: with RLS enabled and no
-- policies, the anon key gets zero rows. The service-role key used by the
-- app server bypasses RLS.
