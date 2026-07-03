import type { VercelRequest, VercelResponse } from '@vercel/node';
import {
  supabaseAdmin,
  migrateLegacyPins,
  hashPin,
  encryptPin,
  verifyPinHash,
  MASTER_LEADER_PIN,
} from './_lib';

// GET /api/leaders — returns only leader names (no PIN data)
// POST /api/leaders — planner only: register a new leader
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (!supabaseAdmin) {
    return res.status(503).json({ error: 'Supabase is not configured on the server.' });
  }

  if (req.method === 'GET') {
    await migrateLegacyPins();
    const { data, error } = await supabaseAdmin
      .from('leaders')
      .select('id, name, created_at')
      .order('created_at', { ascending: true });
    if (error) return res.status(500).json({ error: error.message });
    return res.json({ leaders: data || [] });
  }

  if (req.method === 'POST') {
    const provided = String(req.headers['x-admin-pin'] || '');
    const expected = process.env.PLANNER_PIN || '5555';
    if (provided !== expected) {
      return res.status(401).json({ error: 'Planner authorization required.' });
    }

    await migrateLegacyPins();

    const name = String(req.body?.name || '').trim();
    const pin = String(req.body?.pin || '').trim();
    if (!name) return res.status(400).json({ error: 'Name is required.' });
    if (pin.length !== 4) return res.status(400).json({ error: 'PIN must be exactly 4 characters.' });
    if (pin === MASTER_LEADER_PIN) return res.status(409).json({ error: 'This PIN code is reserved.' });

    const { data: existing, error: selErr } = await supabaseAdmin.from('leaders').select('id, pin, pin_hash');
    if (selErr) return res.status(500).json({ error: selErr.message });
    const duplicate = (existing || []).some((l: any) => verifyPinHash(pin, l.pin_hash) || (l.pin && l.pin === pin));
    if (duplicate) return res.status(409).json({ error: 'This PIN code is already registered.' });

    const payload: any = { name, pin_hash: hashPin(pin) };
    const enc = encryptPin(pin);
    if (enc) payload.pin_encrypted = enc;

    const { data, error } = await supabaseAdmin.from('leaders').insert(payload).select('id, name, created_at');
    if (error) return res.status(500).json({ error: error.message });
    return res.json({ leader: data?.[0] || null });
  }

  return res.status(405).json({ error: 'Method not allowed' });
}

