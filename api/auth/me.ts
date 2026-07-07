import { verifyJwt, parseCookies, JWT_SECRET } from '../_lib';

export default async function handler(req: any, res: any) {
  try {
    if (req.method !== 'GET') {
      return res.status(405).json({ error: 'Method not allowed' });
    }

    const cookies = parseCookies(req.headers.cookie);
    const token = cookies['sugity_session'];

    if (!token) {
      return res.json({ authenticated: false });
    }

    const decoded = verifyJwt(token, JWT_SECRET);
    if (!decoded) {
      return res.json({ authenticated: false });
    }

    return res.json({
      authenticated: true,
      user: {
        email: decoded.email,
        role: decoded.role,
        name: decoded.name
      }
    });
  } catch (err: any) {
    console.error('[/api/auth/me] Unhandled error:', err);
    return res.status(500).json({ error: err?.message || 'Internal server error' });
  }
}
