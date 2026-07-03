import { createClient } from '@supabase/supabase-js';
import { randomBytes, scryptSync, createCipheriv, createDecipheriv, timingSafeEqual } from 'crypto';

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || '';
const PLANNER_PIN = process.env.PLANNER_PIN || '5555';
const MASTER_LEADER_PIN = process.env.MASTER_LEADER_PIN || '8888';
const PIN_ENC_KEY = (process.env.PIN_ENCRYPTION_KEY || '').trim();

let supabase: ReturnType<typeof createClient> | null = null;
try {
  if (SUPABASE_URL && SUPABASE_KEY) {
    supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
  }
} catch (_) {}

const getEncKey = (): Buffer | null => {
  if (/^[0-9a-fA-F]{64}$/.test(PIN_ENC_KEY)) return Buffer.from(PIN_ENC_KEY, 'hex');
  return null;
};

const hashPin = (pin: string): string => {
  const salt = randomBytes(16);
  const derived = scryptSync(pin, salt, 64);
  return `scrypt:${salt.toString('hex')}:${derived.toString('hex')}`;
};

const verifyHash = (pin: string, stored: string | null | undefined): boolean => {
  if (!stored || !stored.startsWith('scrypt:')) return false;
  const parts = stored.split(':');
  if (parts.length < 3) return false;
  const saltHex = parts[1];
  const hashHex = parts[2];
  try {
    const derived = scryptSync(pin, Buffer.from(saltHex, 'hex'), 64);
    const expected = Buffer.from(hashHex, 'hex');
    return derived.length === expected.length && timingSafeEqual(derived, expected);
  } catch { return false; }
};

const encryptPin = (pin: string): string | null => {
  const key = getEncKey();
  if (!key) return null;
  try {
    const iv = randomBytes(12);
    const cipher = createCipheriv('aes-256-gcm', key, iv);
    const ct = Buffer.concat([cipher.update(pin, 'utf8'), cipher.final()]);
    const tag = cipher.getAuthTag();
    return `${iv.toString('hex')}:${tag.toString('hex')}:${ct.toString('hex')}`;
  } catch { return null; }
};

export default async function handler(req: any, res: any) {
  try {
    if (!supabase) {
      return res.status(503).json({ error: 'Supabase is not configured.' });
    }

    // GET /api/leaders — public: list names only
    if (req.method === 'GET') {
      const { data, error } = await supabase
        .from('leaders')
        .select('id, name, created_at')
        .order('created_at', { ascending: true });
      if (error) return res.status(500).json({ error: error.message });
      return res.json({ leaders: data || [] });
    }

    // POST /api/leaders — planner only: create leader
    if (req.method === 'POST') {
      const adminPin = String(req.headers['x-admin-pin'] || '');
      if (adminPin !== PLANNER_PIN) {
        return res.status(401).json({ error: 'Planner authorization required.' });
      }

      const name = String(req.body?.name || '').trim();
      const pin = String(req.body?.pin || '').trim();
      if (!name) return res.status(400).json({ error: 'Name is required.' });
      if (pin.length !== 4) return res.status(400).json({ error: 'PIN must be exactly 4 characters.' });
      if (pin === MASTER_LEADER_PIN) return res.status(409).json({ error: 'This PIN code is reserved.' });

      const { data: existing, error: selErr } = await supabase.from('leaders').select('id, pin, pin_hash');
      if (selErr) return res.status(500).json({ error: selErr.message });
      const duplicate = (existing || []).some((l: any) => verifyHash(pin, l.pin_hash) || (l.pin && l.pin === pin));
      if (duplicate) return res.status(409).json({ error: 'This PIN code is already registered.' });

      const payload: any = { name, pin_hash: hashPin(pin) };
      const enc = encryptPin(pin);
      if (enc) payload.pin_encrypted = enc;

      const { data, error } = await supabase.from('leaders').insert(payload).select('id, name, created_at');
      if (error) return res.status(500).json({ error: error.message });
      return res.json({ leader: data?.[0] || null });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (err: any) {
    console.error('[/api/leaders] Unhandled error:', err);
    return res.status(500).json({ error: err?.message || 'Internal server error' });
  }
}
