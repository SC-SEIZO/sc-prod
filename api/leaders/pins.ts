import type { VercelRequest, VercelResponse } from '@vercel/node';
import { supabaseAdmin, migrateLegacyPins, decryptPin, getEncryptionKey } from './_lib';

// GET /api/leaders/pins — planner only: reveals decrypted PINs
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  if (!supabaseAdmin) {
    return res.status(503).json({ error: 'Supabase is not configured on the server.' });
  }

  const provided = String(req.headers['x-admin-pin'] || '');
  const expected = process.env.PLANNER_PIN || '5555';
  if (provided !== expected) {
    return res.status(401).json({ error: 'Planner authorization required.' });
  }

  await migrateLegacyPins();
  const { data, error } = await supabaseAdmin.from('leaders').select('id, name, pin, pin_encrypted');
  if (error) return res.status(500).json({ error: error.message });

  const pins = (data || []).map((l: any) => ({
    id: l.id,
    name: l.name,
    pin: decryptPin(l.pin_encrypted) || l.pin || null
  }));
  return res.json({ pins, encryptionConfigured: !!getEncryptionKey() });
}
