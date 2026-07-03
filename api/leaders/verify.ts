import type { VercelRequest, VercelResponse } from '@vercel/node';
import { supabaseAdmin, migrateLegacyPins, verifyPinHash, MASTER_LEADER_PIN } from '../_lib';

// POST /api/leaders/verify
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  if (!supabaseAdmin) {
    return res.status(503).json({ error: 'Supabase is not configured on the server.' });
  }

  await migrateLegacyPins();
  const pin = String(req.body?.pin || '').trim();
  if (!pin) return res.status(400).json({ error: 'PIN is required.' });

  if (pin === MASTER_LEADER_PIN) {
    return res.json({ leader: { id: 'master', name: 'Master Leader' } });
  }

  const { data, error } = await supabaseAdmin.from('leaders').select('id, name, pin, pin_hash');
  if (error) return res.status(500).json({ error: error.message });

  const match = (data || []).find((l: any) => verifyPinHash(pin, l.pin_hash) || (l.pin && l.pin === pin));
  if (!match) return res.status(401).json({ error: 'Invalid Leader PIN.' });
  return res.json({ leader: { id: match.id, name: match.name } });
}
