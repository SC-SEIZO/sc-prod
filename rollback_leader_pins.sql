-- ============================================================================
-- ROLLBACK: Leader PIN Security Migration
--
-- Prasyarat: SEBELUM menjalankan migration_leader_pins.sql, buat backup dulu
-- dengan menjalankan ini di Supabase SQL Editor:
--
--   CREATE TABLE public.leaders_backup AS SELECT * FROM public.leaders;
--
-- Jika terjadi masalah, jalankan seluruh script di bawah untuk kembali
-- persis ke kondisi sebelum migrasi.
-- ============================================================================

BEGIN;

-- 1. Kembalikan PIN plaintext dari backup
--    (perlu karena server otomatis mengosongkan kolom pin setelah migrasi)
UPDATE public.leaders l
SET pin = b.pin
FROM public.leaders_backup b
WHERE l.id = b.id
  AND l.pin IS NULL;

-- Leader yang terdaftar SETELAH migrasi tidak punya baris backup dan pin-nya
-- NULL. Hapus agar constraint NOT NULL bisa dipasang kembali.
-- (Catat dulu siapa saja: SELECT * FROM public.leaders WHERE pin IS NULL;)
DELETE FROM public.leaders WHERE pin IS NULL;

-- 2. Hapus kolom hasil migrasi
ALTER TABLE public.leaders DROP COLUMN IF EXISTS pin_hash;
ALTER TABLE public.leaders DROP COLUMN IF EXISTS pin_encrypted;

-- 3. Pasang kembali constraint lama
ALTER TABLE public.leaders ALTER COLUMN pin SET NOT NULL;

-- 4. Kembalikan RLS policy lama (akses publik seperti semula)
ALTER TABLE public.leaders ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow public read access" ON public.leaders;
DROP POLICY IF EXISTS "Allow public write" ON public.leaders;
CREATE POLICY "Allow public read access" ON public.leaders FOR SELECT USING (true);
CREATE POLICY "Allow public write" ON public.leaders FOR ALL USING (true);

COMMIT;

-- Setelah rollback berhasil dan diverifikasi, backup boleh dihapus:
--   DROP TABLE public.leaders_backup;
