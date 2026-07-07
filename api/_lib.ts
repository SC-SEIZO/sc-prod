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

