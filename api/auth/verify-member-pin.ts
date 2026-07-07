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

function getMemberPin(factoryName: string, machineId: string): string {
  if (!factoryName || !machineId) return 'XXXX';

  let factoryCode = '';
  const uFact = factoryName.toUpperCase();
  if (uFact === 'FACT 2') {
    factoryCode = 'F2';
  } else if (uFact === 'FACT 3') {
    factoryCode = 'F3';
  } else if (uFact === 'FACT 4') {
    factoryCode = 'F4';
  } else if (uFact.includes('SC2')) {
    factoryCode = 'SC';
  } else {
    const match = factoryName.match(/\d+/);
    factoryCode = match ? `F${match[0]}` : 'F';
  }

  let cleanMachine = machineId.replace(/\s+/g, '');
  if (cleanMachine.toUpperCase().startsWith('MC')) {
    cleanMachine = cleanMachine.substring(2);
  }

  const maxMachineLen = 4 - factoryCode.length;
  let machineCode = cleanMachine.substring(0, maxMachineLen);
  if (machineCode.length < maxMachineLen && /^\d+$/.test(machineCode)) {
    machineCode = machineCode.padStart(maxMachineLen, '0');
  }

  const fullPin = `${factoryCode}${machineCode}`.toUpperCase();
  return fullPin.substring(0, 4);
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
