import { checkRateLimit, getClientIp } from '../_lib';

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
