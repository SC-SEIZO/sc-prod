import crypto from 'crypto';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || '';
const JWT_SECRET = process.env.JWT_SECRET || 'sugity-secret-key-12345!';

let supabaseAdmin: ReturnType<typeof createClient> | null = null;
try {
  if (SUPABASE_URL && SUPABASE_KEY) {
    supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_KEY);
  }
} catch (_) {}

function base64url(buf: Buffer): string {
  return buf.toString('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
}

function signJwt(payload: any, secret: string): string {
  const header = { alg: 'HS256', typ: 'JWT' };
  const part1 = base64url(Buffer.from(JSON.stringify(header)));
  const part2 = base64url(Buffer.from(JSON.stringify(payload)));
  const signature = base64url(
    crypto.createHmac('sha256', secret)
      .update(part1 + '.' + part2)
      .digest()
  );
  return `${part1}.${part2}.${signature}`;
}

function verifyPinHash(pin: string, stored: string | null | undefined): boolean {
  if (!stored || !stored.startsWith('scrypt:')) return false;
  const [, saltHex, hashHex] = stored.split(':');
  if (!saltHex || !hashHex) return false;
  try {
    const derived = crypto.scryptSync(pin, Buffer.from(saltHex, 'hex'), 64);
    const expected = Buffer.from(hashHex, 'hex');
    return derived.length === expected.length && crypto.timingSafeEqual(derived, expected);
  } catch {
    return false;
  }
}

interface RateLimitInfo {
  attempts: number;
  lockoutUntil: number | null;
}

const globalRateLimits: Record<string, RateLimitInfo> = {};

function checkRateLimit(key: string, maxAttempts = 5, lockoutDuration = 60000) {
  const now = Date.now();
  const info = globalRateLimits[key];
  if (info && info.lockoutUntil && now < info.lockoutUntil) {
    return { allowed: false, remainingSeconds: Math.ceil((info.lockoutUntil - now) / 1000) };
  }
  return { allowed: true, remainingSeconds: 0 };
}

function recordFailure(key: string, maxAttempts = 5, lockoutDuration = 60000) {
  const now = Date.now();
  if (!globalRateLimits[key]) {
    globalRateLimits[key] = { attempts: 0, lockoutUntil: null };
  }
  const info = globalRateLimits[key];
  if (info.lockoutUntil && now >= info.lockoutUntil) {
    info.attempts = 0;
    info.lockoutUntil = null;
  }
  info.attempts += 1;
  if (info.attempts >= maxAttempts) {
    info.lockoutUntil = now + lockoutDuration;
    return { lockedOut: true, attempts: info.attempts, remainingAttempts: 0 };
  }
  return { lockedOut: false, attempts: info.attempts, remainingAttempts: maxAttempts - info.attempts };
}

function recordSuccess(key: string) {
  if (globalRateLimits[key]) {
    delete globalRateLimits[key];
  }
}

function getClientIp(req: any): string {
  if (req.headers && req.headers['x-forwarded-for']) {
    const forwarded = req.headers['x-forwarded-for'];
    if (Array.isArray(forwarded)) return forwarded[0];
    return String(forwarded).split(',')[0].trim();
  }
  return req.ip || req.socket?.remoteAddress || 'unknown-ip';
}

export default async function handler(req: any, res: any) {
  try {
    if (req.method !== 'POST') {
      return res.status(405).json({ error: 'Method not allowed' });
    }
    if (!supabaseAdmin) {
      return res.status(503).json({ error: 'Supabase is not configured on the server.' });
    }

    const username = String(req.body?.username || '').trim().toLowerCase();
    const password = String(req.body?.password || '').trim();

    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password are required.' });
    }

    if (username.length < 3) {
      return res.status(400).json({ error: 'Username must be at least 3 characters long.' });
    }

    const clientIp = getClientIp(req);
    const rateLimitKey = `device_login:${clientIp}`;
    const check = checkRateLimit(rateLimitKey);
    if (!check.allowed) {
      return res.status(429).json({ error: `Too many login attempts. Locked out. Try again in ${check.remainingSeconds}s.` });
    }

    // Query user by username
    const { data, error } = await supabaseAdmin
      .from('users')
      .select('id, username, role, name, password_hash')
      .eq('username', username)
      .maybeSingle();

    const user = data as any;

    if (error) return res.status(500).json({ error: error.message });
    if (!user || !user.password_hash) {
      const limitResult = recordFailure(rateLimitKey);
      if (limitResult.lockedOut) {
        return res.status(429).json({ error: 'Too many login attempts. Locked out for 60 seconds.' });
      }
      return res.status(401).json({ error: `Invalid username or password. (${limitResult.attempts}/5 attempts)` });
    }

    const isMatched = verifyPinHash(password, user.password_hash);
    if (!isMatched) {
      const limitResult = recordFailure(rateLimitKey);
      if (limitResult.lockedOut) {
        return res.status(429).json({ error: 'Too many login attempts. Locked out for 60 seconds.' });
      }
      return res.status(401).json({ error: `Invalid username or password. (${limitResult.attempts}/5 attempts)` });
    }

    // Success! Reset attempts
    recordSuccess(rateLimitKey);

    // Create session payload
    const token = signJwt(
      {
        userId: user.id,
        username: user.username,
        role: user.role,
        name: user.name,
        exp: Math.floor(Date.now() / 1000) + 60 * 60 * 24 // 24 hours
      },
      JWT_SECRET
    );

    // Set cookie
    const isProd = process.env.NODE_ENV === 'production' || process.env.VERCEL === '1';
    res.setHeader(
      'Set-Cookie',
      `sugity_session=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=86400${isProd ? '; Secure' : ''}`
    );

    return res.json({
      success: true,
      user: {
        id: user.id,
        username: user.username,
        role: user.role,
        name: user.name
      }
    });
  } catch (err: any) {
    console.error('[/api/auth/login] Error:', err);
    return res.status(500).json({ error: err?.message || 'Internal server error' });
  }
}
