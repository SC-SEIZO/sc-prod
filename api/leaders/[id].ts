import type { VercelRequest, VercelResponse } from '@vercel/node';
import { supabaseAdmin } from './_lib';

// DELETE /api/leaders/[id]
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'DELETE') {
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

  const { id } = req.query;
  if (!id || typeof id !== 'string') {
    return res.status(400).json({ error: 'Leader ID is required.' });
  }

  const { error } = await supabaseAdmin.from('leaders').delete().eq('id', id);
  if (error) return res.status(500).json({ error: error.message });
  return res.json({ success: true });
}
