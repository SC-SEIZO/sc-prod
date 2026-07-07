import { supabaseAdmin, verifyPinHash, signJwt, JWT_SECRET, checkRateLimit, recordFailure, recordSuccess } from '../_lib';

export default async function handler(req: any, res: any) {
  try {
    if (req.method !== 'POST') {
      return res.status(405).json({ error: 'Method not allowed' });
    }
    if (!supabaseAdmin) {
      return res.status(503).json({ error: 'Supabase is not configured on the server.' });
    }

    const email = String(req.body?.email || '').trim().toLowerCase();
    const password = String(req.body?.password || '').trim();

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required.' });
    }

    const clientIp = req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'unknown-ip';
    const rateLimitKey = `device_login:${clientIp}`;
    const check = checkRateLimit(rateLimitKey);
    if (!check.allowed) {
      return res.status(429).json({ error: `Too many login attempts. Locked out. Try again in ${check.remainingSeconds}s.` });
    }

    // Query user by email
    const { data: user, error } = await supabaseAdmin
      .from('users')
      .select('id, email, role, name, password_hash')
      .eq('email', email)
      .maybeSingle();

    if (error) {
      return res.status(500).json({ error: error.message });
    }

    if (!user || !user.password_hash) {
      const limitResult = recordFailure(rateLimitKey);
      if (limitResult.lockedOut) {
        return res.status(429).json({ error: 'Too many login attempts. Locked out for 60 seconds.' });
      }
      return res.status(401).json({ error: `Invalid email or password. (${limitResult.attempts}/5 attempts)` });
    }

    // Verify password hash (using the same scrypt check)
    const isMatched = verifyPinHash(password, user.password_hash);
    if (!isMatched) {
      const limitResult = recordFailure(rateLimitKey);
      if (limitResult.lockedOut) {
        return res.status(429).json({ error: 'Too many login attempts. Locked out for 60 seconds.' });
      }
      return res.status(401).json({ error: `Invalid email or password. (${limitResult.attempts}/5 attempts)` });
    }

    // Sign JWT
    recordSuccess(rateLimitKey);
    const payload = {
      id: user.id,
      email: user.email,
      role: user.role,
      name: user.name,
      timestamp: Date.now()
    };
    const token = signJwt(payload, JWT_SECRET);

    // Set cookie
    const isProd = process.env.NODE_ENV === 'production';
    const cookieAttrs = [
      `sugity_session=${token}`,
      'HttpOnly',
      'Path=/',
      'Max-Age=2592000', // 30 days
      'SameSite=Lax',
      isProd ? 'Secure' : ''
    ].filter(Boolean).join('; ');

    res.setHeader('Set-Cookie', cookieAttrs);
    return res.json({
      success: true,
      user: {
        email: user.email,
        role: user.role,
        name: user.name
      }
    });
  } catch (err: any) {
    console.error('[/api/auth/login] Unhandled error:', err);
    return res.status(500).json({ error: err?.message || 'Internal server error' });
  }
}
