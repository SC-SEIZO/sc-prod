import { createClient } from '@supabase/supabase-js';
import { createDecipheriv } from 'crypto';

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || '';
const PLANNER_PIN = process.env.PLANNER_PIN || '5555';
const PIN_ENC_KEY = (process.env.PIN_ENCRYPTION_KEY || '').trim();

let supabase: ReturnType<typeof createClient> | null = null;
try {
  if (SUPABASE_URL && SUPABASE_KEY) supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
} catch (_) {}

const decryptPin = (blob: string | null | undefined): string | null => {
  if (!blob || !/^[0-9a-fA-F]{64}$/.test(PIN_ENC_KEY)) return null;
  const parts = blob.split(':');
  if (parts.length < 3) return null;
  try {
    const key = Buffer.from(PIN_ENC_KEY, 'hex');
    const decipher = createDecipheriv('aes-256-gcm', key, Buffer.from(parts[0], 'hex'));
    decipher.setAuthTag(Buffer.from(parts[1], 'hex'));
    return Buffer.concat([decipher.update(Buffer.from(parts[2], 'hex')), decipher.final()]).toString('utf8');
  } catch { return null; }
};

// GET /api/leaders/pins
export default async function handler(req: any, res: any) {
  try {
    if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });
    if (!supabase) return res.status(503).json({ error: 'Supabase is not configured.' });

    const adminPin = String(req.headers['x-admin-pin'] || '');
    if (adminPin !== PLANNER_PIN) return res.status(401).json({ error: 'Planner authorization required.' });

    const { data, error } = await supabase.from('leaders').select('id, name, pin, pin_encrypted');
    if (error) return res.status(500).json({ error: error.message });

    const pins = (data || []).map((l: any) => ({
      id: l.id,
      name: l.name,
      pin: decryptPin(l.pin_encrypted) || l.pin || null
    }));
    return res.json({ pins, encryptionConfigured: /^[0-9a-fA-F]{64}$/.test(PIN_ENC_KEY) });
  } catch (err: any) {
    console.error('[/api/leaders/pins] Unhandled error:', err);
    return res.status(500).json({ error: err?.message || 'Internal server error' });
  }
}
