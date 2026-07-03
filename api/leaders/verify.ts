import { createClient } from '@supabase/supabase-js';
import { scryptSync, timingSafeEqual } from 'crypto';

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || '';
const MASTER_LEADER_PIN = process.env.MASTER_LEADER_PIN || '8888';

let supabase: ReturnType<typeof createClient> | null = null;
try {
  if (SUPABASE_URL && SUPABASE_KEY) supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
} catch (_) {}

const verifyHash = (pin: string, stored: string | null | undefined): boolean => {
  if (!stored || !stored.startsWith('scrypt:')) return false;
  const parts = stored.split(':');
  if (parts.length < 3) return false;
  try {
    const derived = scryptSync(pin, Buffer.from(parts[1], 'hex'), 64);
    const expected = Buffer.from(parts[2], 'hex');
    return derived.length === expected.length && timingSafeEqual(derived, expected);
  } catch { return false; }
};

// POST /api/leaders/verify
export default async function handler(req: any, res: any) {
  try {
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
    if (!supabase) return res.status(503).json({ error: 'Supabase is not configured.' });

    const pin = String(req.body?.pin || '').trim();
    if (!pin) return res.status(400).json({ error: 'PIN is required.' });

    if (pin === MASTER_LEADER_PIN) {
      return res.json({ leader: { id: 'master', name: 'Master Leader' } });
    }

    const { data, error } = await supabase.from('leaders').select('id, name, pin, pin_hash');
    if (error) return res.status(500).json({ error: error.message });

    const match = (data || []).find((l: any) => verifyHash(pin, l.pin_hash) || (l.pin && l.pin === pin));
    if (!match) return res.status(401).json({ error: 'Invalid Leader PIN.' });
    return res.json({ leader: { id: match.id, name: match.name } });
  } catch (err: any) {
    console.error('[/api/leaders/verify] Unhandled error:', err);
    return res.status(500).json({ error: err?.message || 'Internal server error' });
  }
}
