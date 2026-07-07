import { VercelRequest, VercelResponse } from '@vercel/node';
import { supabaseAdmin, verifyJwt, parseCookies, hashPin } from '../_lib';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (!supabaseAdmin) {
    return res.status(503).json({ error: 'Supabase is not configured on the server.' });
  }

  // 1. Authenticate and check if the user is a super-admin
  const cookies = parseCookies(req.headers.cookie);
  const token = cookies['sugity_session'];

  if (!token) {
    return res.status(401).json({ error: 'Authorization token is missing.' });
  }

  const decoded = verifyJwt(token, process.env.JWT_SECRET || 'sugity-secret-key-12345!');
  if (!decoded || decoded.role !== 'super-admin') {
    return res.status(403).json({ error: 'Access denied. Super Admin privileges required.' });
  }

  const method = req.method;

  try {
    // --- GET: Fetch all users ---
    if (method === 'GET') {
      const { data: users, error } = await supabaseAdmin
        .from('users')
        .select('id, uid, email, role, name, photo_url, created_at')
        .order('created_at', { ascending: false });

      if (error) return res.status(500).json({ error: error.message });
      return res.json({ users: users || [] });
    }

    // --- POST: Create a new user ---
    if (method === 'POST') {
      const email = String(req.body?.email || '').trim().toLowerCase();
      const role = String(req.body?.role || '').trim();
      const name = String(req.body?.name || '').trim();
      const password = String(req.body?.password || '').trim();

      if (!email || !role || !name || !password) {
        return res.status(400).json({ error: 'Email, role, name, and password are required.' });
      }

      // Validate role
      const validRoles = ['super-admin', 'planner', 'leader', 'member', 'production-board'];
      if (!validRoles.includes(role)) {
        return res.status(400).json({ error: 'Invalid user role specified.' });
      }

      const { data, error } = await supabaseAdmin
        .from('users')
        .insert({
          uid: `uid-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
          email,
          role,
          name,
          password_hash: hashPin(password)
        })
        .select('id, email, role, name, created_at')
        .single();

      if (error) {
        if (error.code === '23505') {
          return res.status(400).json({ error: 'Email address already registered.' });
        }
        return res.status(500).json({ error: error.message });
      }

      return res.status(201).json({ success: true, user: data });
    }

    // --- PUT: Update user details ---
    if (method === 'PUT') {
      const id = String(req.body?.id || '').trim();
      const email = String(req.body?.email || '').trim().toLowerCase();
      const role = String(req.body?.role || '').trim();
      const name = String(req.body?.name || '').trim();
      const password = String(req.body?.password || '').trim();

      if (!id || !email || !role || !name) {
        return res.status(400).json({ error: 'ID, email, role, and name are required.' });
      }

      // Validate role
      const validRoles = ['super-admin', 'planner', 'leader', 'member', 'production-board'];
      if (!validRoles.includes(role)) {
        return res.status(400).json({ error: 'Invalid user role specified.' });
      }

      const updatePayload: any = { email, role, name };
      if (password) {
        updatePayload.password_hash = hashPin(password);
      }

      const { data, error } = await supabaseAdmin
        .from('users')
        .update(updatePayload)
        .eq('id', id)
        .select('id, email, role, name, created_at')
        .single();

      if (error) return res.status(500).json({ error: error.message });
      return res.json({ success: true, user: data });
    }

    // --- DELETE: Delete user ---
    if (method === 'DELETE') {
      const id = String(req.body?.id || req.query?.id || '').trim();

      if (!id) {
        return res.status(400).json({ error: 'User ID is required for deletion.' });
      }

      // Prevent Super Admin from deleting themselves
      if (id === decoded.id) {
        return res.status(400).json({ error: 'You cannot delete your own Super Admin account.' });
      }

      const { error } = await supabaseAdmin
        .from('users')
        .delete()
        .eq('id', id);

      if (error) return res.status(500).json({ error: error.message });
      return res.json({ success: true });
    }

    return res.status(405).json({ error: `Method ${method} not allowed` });
  } catch (err: any) {
    console.error('[User Management API] Error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
