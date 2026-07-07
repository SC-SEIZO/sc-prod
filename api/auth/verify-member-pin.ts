import { getMemberPin, checkRateLimit, recordFailure, recordSuccess, getClientIp } from '../_lib';

export default async function handler(req: any, res: any) {
  try {
    if (req.method !== 'POST') {
      return res.status(405).json({ error: 'Method not allowed' });
    }

    const { factory, machineId, pin } = req.body;

    if (!factory || !machineId || !pin) {
      return res.status(400).json({ error: 'Factory, Machine ID, and PIN are required.' });
    }

    const clientIp = getClientIp(req);
    const rateLimitKey = `member_login:${clientIp}`;
    
    // Check rate limit
    const check = checkRateLimit(rateLimitKey);
    if (!check.allowed) {
      return res.status(429).json({ error: `Too many login attempts. Locked out. Try again in ${check.remainingSeconds}s.` });
    }

    const expectedPin = getMemberPin(factory, machineId);
    if (pin.trim().toUpperCase() !== expectedPin) {
      const limitResult = recordFailure(rateLimitKey);
      if (limitResult.lockedOut) {
        return res.status(429).json({ error: 'Too many login attempts. Locked out for 60 seconds.' });
      }
      return res.status(401).json({ error: `Incorrect Member PIN. (${limitResult.attempts}/5 attempts)` });
    }

    // Success! Reset attempts
    recordSuccess(rateLimitKey);

    return res.json({ success: true });
  } catch (err: any) {
    console.error('[/api/auth/verify-member-pin] Error:', err);
    return res.status(500).json({ error: err?.message || 'Internal server error' });
  }
}
