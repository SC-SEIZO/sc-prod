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
