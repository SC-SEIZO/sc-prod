interface RateLimitInfo {
  attempts: number;
  lockoutUntil: number | null;
}

// In-memory store local to this container instance
const globalRateLimits: Record<string, RateLimitInfo> = {};

function checkRateLimit(key: string, maxAttempts = 5, lockoutDuration = 60000) {
  const now = Date.now();
  const info = globalRateLimits[key];
  if (info && info.lockoutUntil && now < info.lockoutUntil) {
    return { allowed: false, remainingSeconds: Math.ceil((info.lockoutUntil - now) / 1000) };
  }
  return { allowed: true, remainingSeconds: 0 };
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
    if (req.method !== 'GET') {
      return res.status(405).json({ error: 'Method not allowed' });
    }

    const clientIp = getClientIp(req);
    const deviceCheck = checkRateLimit(`device_login:${clientIp}`);
    const memberCheck = checkRateLimit(`member_login:${clientIp}`);

    return res.json({
      deviceLockoutRemaining: deviceCheck.allowed ? 0 : deviceCheck.remainingSeconds,
      memberLockoutRemaining: memberCheck.allowed ? 0 : memberCheck.remainingSeconds
    });
  } catch (err: any) {
    console.error('[/api/auth/rate-limit-status] Error:', err);
    return res.status(500).json({ error: err?.message || 'Internal server error' });
  }
}
