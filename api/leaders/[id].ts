import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || '';
const PLANNER_PIN = process.env.PLANNER_PIN || '5555';

let supabase: ReturnType<typeof createClient> | null = null;
try {
  if (SUPABASE_URL && SUPABASE_KEY) supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
} catch (_) {}

// DELETE /api/leaders/[id]
export default async function handler(req: any, res: any) {
  try {
    if (req.method !== 'DELETE') return res.status(405).json({ error: 'Method not allowed' });
    if (!supabase) return res.status(503).json({ error: 'Supabase is not configured.' });

    const adminPin = String(req.headers['x-admin-pin'] || '');
    if (adminPin !== PLANNER_PIN) return res.status(401).json({ error: 'Planner authorization required.' });

    const id = req.query?.id;
    if (!id || typeof id !== 'string') return res.status(400).json({ error: 'Leader ID is required.' });

    const { error } = await supabase.from('leaders').delete().eq('id', id);
    if (error) return res.status(500).json({ error: error.message });
    return res.json({ success: true });
  } catch (err: any) {
    console.error('[/api/leaders/[id]] Unhandled error:', err);
    return res.status(500).json({ error: err?.message || 'Internal server error' });
  }
}
