import 'dotenv/config';
import express from 'express';
import path from 'path';
import crypto from 'crypto';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI, Type } from '@google/genai';
import { createClient } from '@supabase/supabase-js';
import { JWT_SECRET, signJwt, verifyJwt, parseCookies, checkRateLimit, recordFailure, recordSuccess, getMemberPin } from './api/_lib';


// ---------------------------------------------------------------------------
// Leader PIN security
// ---------------------------------------------------------------------------
// PINs are never sent to the browser in plaintext lists. The client only ever
// receives leader names. Verification and (planner-only) PIN reveal happen on
// this server:
//   - pin_hash      : scrypt hash, used to verify a submitted PIN
//   - pin_encrypted : AES-256-GCM ciphertext, decrypted server-side so the
//                     planner registry can still display the original PIN
// Requires (see .env):
//   PIN_ENCRYPTION_KEY        64 hex chars (32 bytes) encryption key
//   SUPABASE_SERVICE_ROLE_KEY service key so the server can access the
//                             leaders table once RLS locks out anon clients
// ---------------------------------------------------------------------------

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || '';
const supabaseAdmin = SUPABASE_URL && SUPABASE_KEY ? createClient(SUPABASE_URL, SUPABASE_KEY) : null;

// Admin PIN gating the planner-only endpoints (register/delete/reveal leaders).
// Kept in sync with the planner portal PIN.
const PLANNER_ADMIN_PIN = process.env.PLANNER_PIN || '5555';
// Emergency master leader PIN (server-side only, never shipped to the browser bundle).
const MASTER_LEADER_PIN = process.env.MASTER_LEADER_PIN || '8888';

const getEncryptionKey = (): Buffer | null => {
  const hex = (process.env.PIN_ENCRYPTION_KEY || '').trim();
  if (/^[0-9a-fA-F]{64}$/.test(hex)) return Buffer.from(hex, 'hex');
  return null;
};

const hashPin = (pin: string): string => {
  const salt = crypto.randomBytes(16);
  const derived = crypto.scryptSync(pin, salt, 64);
  return `scrypt:${salt.toString('hex')}:${derived.toString('hex')}`;
};

const verifyPinHash = (pin: string, stored: string | null | undefined): boolean => {
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

const encryptPin = (pin: string): string | null => {
  const key = getEncryptionKey();
  if (!key) return null;
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const ciphertext = Buffer.concat([cipher.update(pin, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${iv.toString('hex')}:${tag.toString('hex')}:${ciphertext.toString('hex')}`;
};

const decryptPin = (blob: string | null | undefined): string | null => {
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

// One-time lazy migration: hash + encrypt any legacy plaintext PINs, then blank them.
let pinMigrationDone = false;
const migrateLegacyPins = async () => {
  if (pinMigrationDone || !supabaseAdmin) return;
  try {
    const { data, error } = await supabaseAdmin.from('leaders').select('id, pin, pin_hash');
    if (error) {
      // Columns may not exist yet — instruct via log, don't crash.
      console.warn('[leaders] PIN migration skipped:', error.message, '— run migration_leader_pins.sql in Supabase.');
      return;
    }
    for (const row of data || []) {
      if (row.pin && !row.pin_hash) {
        const update: any = { pin_hash: hashPin(row.pin), pin: null };
        const enc = encryptPin(row.pin);
        if (enc) update.pin_encrypted = enc;
        const { error: upErr } = await supabaseAdmin.from('leaders').update(update).eq('id', row.id);
        if (upErr) {
          console.warn('[leaders] Failed migrating PIN for leader', row.id, upErr.message);
          return;
        }
        console.log('[leaders] Migrated plaintext PIN to hash for leader', row.id);
      }
    }
    pinMigrationDone = true;
  } catch (e: any) {
    console.warn('[leaders] PIN migration error:', e?.message || e);
  }
};

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Increase payload limit for base64 file uploads
  app.use(express.json({ limit: '50mb' }));
  app.use(express.urlencoded({ limit: '50mb', extended: true }));

  // ------------------------------------------------------------------
  // Leader PIN API (PINs never leave the server in list responses)
  // ------------------------------------------------------------------
  const requireDb = (res: express.Response): boolean => {
    if (!supabaseAdmin) {
      res.status(503).json({ error: 'Supabase is not configured on the server.' });
      return false;
    }
    return true;
  };

  const requirePlannerAdmin = (req: express.Request, res: express.Response): boolean => {
    const provided = String(req.headers['x-admin-pin'] || '');
    const expected = Buffer.from(PLANNER_ADMIN_PIN);
    const got = Buffer.from(provided);
    const ok = expected.length === got.length && crypto.timingSafeEqual(expected, got);
    if (!ok) {
      res.status(401).json({ error: 'Planner authorization required.' });
      return false;
    }
    return true;
  };

  // Public: leader names only — no PIN data of any form.
  app.get('/api/leaders', async (_req, res) => {
    if (!requireDb(res)) return;
    await migrateLegacyPins();
    const { data, error } = await supabaseAdmin!
      .from('leaders')
      .select('id, name, created_at')
      .order('created_at', { ascending: true });
    if (error) return res.status(500).json({ error: error.message });
    res.json({ leaders: data || [] });
  });

  // Public: verify a PIN. Returns the matched leader's identity only.
  app.post('/api/leaders/verify', async (req, res) => {
    if (!requireDb(res)) return;
    await migrateLegacyPins();
    const pin = String(req.body?.pin || '').trim();
    if (!pin) return res.status(400).json({ error: 'PIN is required.' });

    if (pin === MASTER_LEADER_PIN) {
      return res.json({ leader: { id: 'master', name: 'Master Leader' } });
    }

    const { data, error } = await supabaseAdmin!.from('leaders').select('id, name, pin, pin_hash');
    if (error) return res.status(500).json({ error: error.message });

    const match = (data || []).find(l => verifyPinHash(pin, l.pin_hash) || (l.pin && l.pin === pin));
    if (!match) return res.status(401).json({ error: 'Invalid Leader PIN.' });
    res.json({ leader: { id: match.id, name: match.name } });
  });

  // ------------------------------------------------------------------
  // Device Auth APIs (JWT in Cookies)
  // ------------------------------------------------------------------

  // POST /api/auth/login: verify email/password and set HttpOnly cookie
  app.post('/api/auth/login', async (req, res) => {
    if (!requireDb(res)) return;
    try {
      const email = String(req.body?.email || '').trim().toLowerCase();
      const password = String(req.body?.password || '').trim();

      if (!email || !password) {
        return res.status(400).json({ error: 'Email and password are required.' });
      }

      const clientIp = req.ip || req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'unknown-ip';
      const rateLimitKey = `device_login:${clientIp}`;
      const check = checkRateLimit(rateLimitKey as string);
      if (!check.allowed) {
        return res.status(429).json({ error: `Too many login attempts. Locked out. Try again in ${check.remainingSeconds}s.` });
      }

      const { data: user, error } = await supabaseAdmin!
        .from('users')
        .select('id, email, role, name, password_hash')
        .eq('email', email)
        .maybeSingle();

      if (error) return res.status(500).json({ error: error.message });
      if (!user || !user.password_hash) {
        const limitResult = recordFailure(rateLimitKey as string);
        if (limitResult.lockedOut) {
          return res.status(429).json({ error: 'Too many login attempts. Locked out for 60 seconds.' });
        }
        return res.status(401).json({ error: `Invalid email or password. (${limitResult.attempts}/5 attempts)` });
      }

      const isMatched = verifyPinHash(password, user.password_hash);
      if (!isMatched) {
        const limitResult = recordFailure(rateLimitKey as string);
        if (limitResult.lockedOut) {
          return res.status(429).json({ error: 'Too many login attempts. Locked out for 60 seconds.' });
        }
        return res.status(401).json({ error: `Invalid email or password. (${limitResult.attempts}/5 attempts)` });
      }

      recordSuccess(rateLimitKey as string);

      const payload = {
        id: user.id,
        email: user.email,
        role: user.role,
        name: user.name,
        timestamp: Date.now()
      };
      const token = signJwt(payload, JWT_SECRET);

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
      res.json({
        success: true,
        user: {
          email: user.email,
          role: user.role,
          name: user.name
        }
      });
    } catch (err: any) {
      console.error('[/api/auth/login] Error:', err);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // POST /api/auth/verify-member-pin: verify member PIN with server-side rate-limiting
  app.post('/api/auth/verify-member-pin', (req, res) => {
    try {
      const { factory, machineId, pin } = req.body;

      if (!factory || !machineId || !pin) {
        return res.status(400).json({ error: 'Factory, Machine ID, and PIN are required.' });
      }

      const clientIp = req.ip || req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'unknown-ip';
      const rateLimitKey = `member_login:${clientIp}`;

      // Check rate limit
      const check = checkRateLimit(rateLimitKey as string);
      if (!check.allowed) {
        return res.status(429).json({ error: `Too many login attempts. Locked out. Try again in ${check.remainingSeconds}s.` });
      }

      const expectedPin = getMemberPin(factory, machineId);
      if (pin.trim().toUpperCase() !== expectedPin) {
        const limitResult = recordFailure(rateLimitKey as string);
        if (limitResult.lockedOut) {
          return res.status(429).json({ error: 'Too many login attempts. Locked out for 60 seconds.' });
        }
        return res.status(401).json({ error: `Incorrect Member PIN. (${limitResult.attempts}/5 attempts)` });
      }

      // Success! Reset attempts
      recordSuccess(rateLimitKey as string);

      res.json({ success: true });
    } catch (err: any) {
      console.error('[/api/auth/verify-member-pin] Error:', err);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // GET /api/auth/rate-limit-status: check rate limit status for current IP
  app.get('/api/auth/rate-limit-status', (req, res) => {
    try {
      const clientIp = req.ip || req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'unknown-ip';
      const deviceCheck = checkRateLimit(`device_login:${clientIp}`);
      const memberCheck = checkRateLimit(`member_login:${clientIp}`);

      res.json({
        deviceLockoutRemaining: deviceCheck.allowed ? 0 : deviceCheck.remainingSeconds,
        memberLockoutRemaining: memberCheck.allowed ? 0 : memberCheck.remainingSeconds
      });
    } catch (err: any) {
      console.error('[/api/auth/rate-limit-status] Error:', err);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // GET /api/auth/me: get current authenticated session
  app.get('/api/auth/me', (req, res) => {
    try {
      const cookies = parseCookies(req.headers.cookie);
      const token = cookies['sugity_session'];

      if (!token) {
        return res.json({ authenticated: false });
      }

      const decoded = verifyJwt(token, JWT_SECRET);
      if (!decoded) {
        return res.json({ authenticated: false });
      }

      res.json({
        authenticated: true,
        user: {
          email: decoded.email,
          role: decoded.role,
          name: decoded.name
        }
      });
    } catch (err: any) {
      console.error('[/api/auth/me] Error:', err);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // POST /api/auth/logout: clear session cookie
  app.post('/api/auth/logout', (req, res) => {
    res.setHeader('Set-Cookie', 'sugity_session=; Path=/; Max-Age=0; HttpOnly; SameSite=Lax');
    res.json({ success: true });
  });

  // ------------------------------------------------------------------
  // User Management APIs (Super Admin only)
  // ------------------------------------------------------------------
  app.all('/api/auth/users', async (req, res) => {
    if (!requireDb(res)) return;

    // 1. Authenticate and check if the user is a super-admin
    const cookies = parseCookies(req.headers.cookie);
    const token = cookies['sugity_session'];

    if (!token) {
      return res.status(401).json({ error: 'Authorization token is missing.' });
    }

    const decoded = verifyJwt(token, JWT_SECRET);
    if (!decoded || decoded.role !== 'super-admin') {
      return res.status(403).json({ error: 'Access denied. Super Admin privileges required.' });
    }

    const method = req.method;

    try {
      if (method === 'GET') {
        const { data: users, error } = await supabaseAdmin!
          .from('users')
          .select('id, uid, email, role, name, photo_url, created_at')
          .order('created_at', { ascending: false });

        if (error) return res.status(500).json({ error: error.message });
        return res.json({ users: users || [] });
      }

      if (method === 'POST') {
        const email = String(req.body?.email || '').trim().toLowerCase();
        const role = String(req.body?.role || '').trim();
        const name = String(req.body?.name || '').trim();
        const password = String(req.body?.password || '').trim();

        if (!email || !role || !name || !password) {
          return res.status(400).json({ error: 'Email, role, name, and password are required.' });
        }

        const validRoles = ['super-admin', 'planner', 'leader', 'member', 'production-board'];
        if (!validRoles.includes(role)) {
          return res.status(400).json({ error: 'Invalid user role specified.' });
        }

        const { data, error } = await supabaseAdmin!
          .from('users')
          .insert({
            uid: `uid-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
            email,
            role,
            name,
            password_hash: hashPin(password)
          })
          .select('id, email, role, name, created_at')
          .single();

        if (error) {
          if (error.code === '23505') {
            return res.status(400).json({ error: 'Email address already registered.' });
          }
          return res.status(500).json({ error: error.message });
        }

        return res.status(201).json({ success: true, user: data });
      }

      if (method === 'PUT') {
        const id = String(req.body?.id || '').trim();
        const email = String(req.body?.email || '').trim().toLowerCase();
        const role = String(req.body?.role || '').trim();
        const name = String(req.body?.name || '').trim();
        const password = String(req.body?.password || '').trim();

        if (!id || !email || !role || !name) {
          return res.status(400).json({ error: 'ID, email, role, and name are required.' });
        }

        const validRoles = ['super-admin', 'planner', 'leader', 'member', 'production-board'];
        if (!validRoles.includes(role)) {
          return res.status(400).json({ error: 'Invalid user role specified.' });
        }

        const updatePayload: any = { email, role, name };
        if (password) {
          updatePayload.password_hash = hashPin(password);
        }

        const { data, error } = await supabaseAdmin!
          .from('users')
          .update(updatePayload)
          .eq('id', id)
          .select('id, email, role, name, created_at')
          .single();

        if (error) return res.status(500).json({ error: error.message });
        return res.json({ success: true, user: data });
      }

      if (method === 'DELETE') {
        const id = String(req.body?.id || req.query?.id || '').trim();

        if (!id) {
          return res.status(400).json({ error: 'User ID is required for deletion.' });
        }

        if (id === decoded.id) {
          return res.status(400).json({ error: 'You cannot delete your own Super Admin account.' });
        }

        const { error } = await supabaseAdmin!
          .from('users')
          .delete()
          .eq('id', id);

        if (error) return res.status(500).json({ error: error.message });
        return res.json({ success: true });
      }

      res.status(405).json({ error: `Method ${method} not allowed` });
    } catch (err: any) {
      console.error('[User Management API local] Error:', err);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // Planner only: register a new leader (stores hash + AES-256-GCM ciphertext).
  app.post('/api/leaders', async (req, res) => {
    if (!requireDb(res)) return;
    if (!requirePlannerAdmin(req, res)) return;
    await migrateLegacyPins();

    const name = String(req.body?.name || '').trim();
    const pin = String(req.body?.pin || '').trim();
    if (!name) return res.status(400).json({ error: 'Name is required.' });
    if (pin.length !== 4) return res.status(400).json({ error: 'PIN must be exactly 4 characters.' });
    if (pin === MASTER_LEADER_PIN) return res.status(409).json({ error: 'This PIN code is reserved.' });

    const { data: existing, error: selErr } = await supabaseAdmin!.from('leaders').select('id, pin, pin_hash');
    if (selErr) return res.status(500).json({ error: selErr.message });
    const duplicate = (existing || []).some(l => verifyPinHash(pin, l.pin_hash) || (l.pin && l.pin === pin));
    if (duplicate) return res.status(409).json({ error: 'This PIN code is already registered.' });

    const payload: any = { name, pin_hash: hashPin(pin) };
    const enc = encryptPin(pin);
    if (enc) payload.pin_encrypted = enc;

    const { data, error } = await supabaseAdmin!.from('leaders').insert(payload).select('id, name, created_at');
    if (error) return res.status(500).json({ error: error.message });
    res.json({ leader: data?.[0] || null });
  });

  // Planner only: delete a leader by id.
  app.delete('/api/leaders/:id', async (req, res) => {
    if (!requireDb(res)) return;
    if (!requirePlannerAdmin(req, res)) return;
    const { error } = await supabaseAdmin!.from('leaders').delete().eq('id', req.params.id);
    if (error) return res.status(500).json({ error: error.message });
    res.json({ success: true });
  });

  // Planner only: reveal decrypted PINs for the registry screen.
  app.get('/api/leaders/pins', async (req, res) => {
    if (!requireDb(res)) return;
    if (!requirePlannerAdmin(req, res)) return;
    await migrateLegacyPins();
    const { data, error } = await supabaseAdmin!.from('leaders').select('id, name, pin, pin_encrypted');
    if (error) return res.status(500).json({ error: error.message });
    const pins = (data || []).map(l => ({
      id: l.id,
      name: l.name,
      pin: decryptPin(l.pin_encrypted) || l.pin || null
    }));
    res.json({ pins, encryptionConfigured: !!getEncryptionKey() });
  });

  // AI Extraction API Route
  app.post('/api/extract-order', async (req, res) => {
    try {
      const { fileData, mimeType, filename } = req.body;

      if (!fileData) {
        return res.status(400).json({ error: 'No file data provided' });
      }

      // Ensure API key is configured
      if (!process.env.GEMINI_API_KEY) {
        return res.status(500).json({ error: 'Gemini API is not configured on the server.' });
      }

      const ai = new GoogleGenAI({
        apiKey: process.env.GEMINI_API_KEY,
        httpOptions: {
          headers: { 'User-Agent': 'aistudio-build' }
        }
      });

      const imagePart = {
        inlineData: {
          mimeType: mimeType,
          data: fileData,
        },
      };

      const prompt = `
        You are a highly capable AI assistant that extracts data from manufacturing order documents (SPK, PO, Forecast files).
        Extract a list of orders based on the document provided.
        Identify the following fields for each order found:
        - customer: Name of the customer
        - modelGroup: The model group or part series
        - partName: Determine a reasonable automotive part name if not explicitly stated
        - volume: Production volume or quantity requested (number)
        - qtyDay: Reasonable daily running quantity based on volume divided by approx 20 working days
        - homeMachine: Assign an appropriate machine (e.g. #1, #2 for smaller trims, #5 for mid, #8 for large bumpers)
        - tonnage: Intelligently estimate the injection machine tonnage required (e.g. 1300T, 2500T, 3500T)

        If you cannot determine the volume, default to 0.
        If you cannot determine the customer or model, use "Unknown".
      `;

      const response = await ai.models.generateContent({
        model: 'gemini-3.5-flash',
        contents: { parts: [imagePart, { text: prompt }] },
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                customer: { type: Type.STRING },
                modelGroup: { type: Type.STRING },
                partName: { type: Type.STRING },
                volume: { type: Type.INTEGER },
                qtyDay: { type: Type.INTEGER },
                homeMachine: { type: Type.STRING },
                tonnage: { type: Type.STRING }
              },
              required: ["customer", "modelGroup", "partName", "volume", "qtyDay", "homeMachine", "tonnage"]
            }
          }
        }
      });

      const textOutput = response.text || "[]";
      let orders = [];
      try {
        orders = JSON.parse(textOutput);
      } catch(e) {
        return res.status(500).json({ error: 'Failed to parse AI output', raw: textOutput });
      }

      res.json({ success: true, orders });
    } catch (error: any) {
      console.error('Extraction error:', error);
      res.status(500).json({ error: error.message || 'Error processing document with AI' });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
