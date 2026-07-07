import crypto from 'crypto';
import { createClient } from '@supabase/supabase-js';

export const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '';
export const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || '';
export const supabaseAdmin = SUPABASE_URL && SUPABASE_KEY ? createClient(SUPABASE_URL, SUPABASE_KEY) : null;

export const PLANNER_ADMIN_PIN = process.env.PLANNER_PIN || '5555';
export const MASTER_LEADER_PIN = process.env.MASTER_LEADER_PIN || '8888';

export const getEncryptionKey = (): Buffer | null => {
  const hex = (process.env.PIN_ENCRYPTION_KEY || '').trim();
  if (/^[0-9a-fA-F]{64}$/.test(hex)) return Buffer.from(hex, 'hex');
  return null;
};

export const hashPin = (pin: string): string => {
  const salt = crypto.randomBytes(16);
  const derived = crypto.scryptSync(pin, salt, 64);
  return `scrypt:${salt.toString('hex')}:${derived.toString('hex')}`;
};

export const verifyPinHash = (pin: string, stored: string | null | undefined): boolean => {
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
};

export const encryptPin = (pin: string): string | null => {
  const key = getEncryptionKey();
  if (!key) return null;
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const ciphertext = Buffer.concat([cipher.update(pin, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${iv.toString('hex')}:${tag.toString('hex')}:${ciphertext.toString('hex')}`;
};

export const decryptPin = (blob: string | null | undefined): string | null => {
  const key = getEncryptionKey();
  if (!key || !blob) return null;
  const [ivHex, tagHex, ctHex] = blob.split(':');
  if (!ivHex || !tagHex || !ctHex) return null;
  try {
    const decipher = crypto.createDecipheriv('aes-256-gcm', key, Buffer.from(ivHex, 'hex'));
    decipher.setAuthTag(Buffer.from(tagHex, 'hex'));
    return Buffer.concat([decipher.update(Buffer.from(ctHex, 'hex')), decipher.final()]).toString('utf8');
  } catch {
    return null;
  }
};

export const migrateLegacyPins = async (): Promise<void> => {
  if (!supabaseAdmin) return;
  try {
    const { data, error } = await supabaseAdmin.from('leaders').select('id, pin, pin_hash');
    if (error) {
      console.warn('[leaders] PIN migration skipped:', error.message);
      return;
    }
    for (const row of data || []) {
      if (row.pin && !row.pin_hash) {
        const update: any = { pin_hash: hashPin(row.pin), pin: null };
        const enc = encryptPin(row.pin);
        if (enc) update.pin_encrypted = enc;
        await supabaseAdmin.from('leaders').update(update).eq('id', row.id);
      }
    }
  } catch (e: any) {
    console.warn('[leaders] PIN migration error:', e?.message || e);
  }
};

// --- Custom JWT & Cookie Helpers (Pure JS/TS, No Dependencies) ---
export const JWT_SECRET = process.env.JWT_SECRET || 'sugity-secret-key-12345!';

function base64url(buf: Buffer): string {
  return buf.toString('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
}

function fromBase64url(str: string): Buffer {
  let s = str.replace(/-/g, '+').replace(/_/g, '/');
  while (s.length % 4) s += '=';
  return Buffer.from(s, 'base64');
}

export const signJwt = (payload: any, secret: string): string => {
  const header = { alg: 'HS256', typ: 'JWT' };
  const part1 = base64url(Buffer.from(JSON.stringify(header)));
  const part2 = base64url(Buffer.from(JSON.stringify(payload)));
  const signature = base64url(
    crypto.createHmac('sha256', secret)
      .update(part1 + '.' + part2)
      .digest()
  );
  return `${part1}.${part2}.${signature}`;
};

export const verifyJwt = (token: string, secret: string): any | null => {
  if (!token) return null;
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  const [part1, part2, part3] = parts;
  const expectedSignature = base64url(
    crypto.createHmac('sha256', secret)
      .update(part1 + '.' + part2)
      .digest()
  );
  if (part3 !== expectedSignature) return null;
  try {
    return JSON.parse(fromBase64url(part2).toString('utf8'));
  } catch {
    return null;
  }
};

export const parseCookies = (cookieHeader: string | undefined): Record<string, string> => {
  const list: Record<string, string> = {};
  if (!cookieHeader) return list;
  cookieHeader.split(';').forEach((cookie) => {
    const parts = cookie.split('=');
    const name = parts.shift()?.trim();
    if (name) {
      list[name] = decodeURIComponent(parts.join('='));
    }
  });
  return list;
};

// --- In-Memory Rate-Limiting Tracker ---
interface RateLimitInfo {
  attempts: number;
  lockoutUntil: number | null;
}

const globalRateLimits: Record<string, RateLimitInfo> = {};

export const checkRateLimit = (key: string, maxAttempts = 5, lockoutDuration = 60000) => {
  const now = Date.now();
  const info = globalRateLimits[key];
  if (info && info.lockoutUntil && now < info.lockoutUntil) {
    return { allowed: false, remainingSeconds: Math.ceil((info.lockoutUntil - now) / 1000) };
  }
  return { allowed: true, remainingSeconds: 0 };
};

export const recordFailure = (key: string, maxAttempts = 5, lockoutDuration = 60000) => {
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
};

export const recordSuccess = (key: string) => {
  if (globalRateLimits[key]) {
    delete globalRateLimits[key];
  }
};

// --- Member PIN Calculator (Duplicate of src/lib/utils.ts for server-side validation) ---
export function getMemberPin(factoryName: string, machineId: string): string {
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

// --- Helper to safely parse client IP in serverless and Express environments ---
export function getClientIp(req: any): string {
  if (req.headers && req.headers['x-forwarded-for']) {
    const forwarded = req.headers['x-forwarded-for'];
    if (Array.isArray(forwarded)) return forwarded[0];
    return String(forwarded).split(',')[0].trim();
  }
  return req.ip || req.socket?.remoteAddress || 'unknown-ip';
}

