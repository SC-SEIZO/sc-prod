import 'dotenv/config';
import express from 'express';
import path from 'path';
import crypto from 'crypto';
import http from 'http';
import { Server } from 'socket.io';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI, Type } from '@google/genai';
import { pool } from './db';
import { JWT_SECRET, signJwt, verifyJwt, parseCookies, checkRateLimit, recordFailure, recordSuccess, getMemberPin, getClientIp } from './api/_lib';


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
// ---------------------------------------------------------------------------

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
  if (pinMigrationDone) return;
  try {
    const { rows } = await pool.query('SELECT id, pin, pin_hash FROM leaders');
    for (const row of rows || []) {
      if (row.pin && !row.pin_hash) {
        const pinHash = hashPin(row.pin);
        const enc = encryptPin(row.pin);
        await pool.query(
          'UPDATE leaders SET pin_hash = $1, pin_encrypted = $2, pin = NULL WHERE id = $3',
          [pinHash, enc, row.id]
        );
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
    if (!pool) {
      res.status(503).json({ error: 'Database is not configured on the server.' });
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
    try {
      await migrateLegacyPins();
      const { rows } = await pool.query('SELECT id, name, created_at FROM leaders ORDER BY created_at ASC');
      res.json({ leaders: rows || [] });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Public: verify a PIN. Returns the matched leader's identity only.
  app.post('/api/leaders/verify', async (req, res) => {
    if (!requireDb(res)) return;
    try {
      await migrateLegacyPins();
      const pin = String(req.body?.pin || '').trim();
      if (!pin) return res.status(400).json({ error: 'PIN is required.' });

      if (pin === MASTER_LEADER_PIN) {
        return res.json({ leader: { id: 'master', name: 'Master Leader' } });
      }

      const { rows } = await pool.query('SELECT id, name, pin, pin_hash FROM leaders');
      const match = (rows || []).find(l => verifyPinHash(pin, l.pin_hash) || (l.pin && l.pin === pin));
      if (!match) return res.status(401).json({ error: 'Invalid Leader PIN.' });
      res.json({ leader: { id: match.id, name: match.name } });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // ------------------------------------------------------------------
  // Device Auth APIs (JWT in Cookies)
  // ------------------------------------------------------------------

  // POST /api/auth/login: verify username/password and set HttpOnly cookie
  app.post('/api/auth/login', async (req, res) => {
    if (!requireDb(res)) return;
    try {
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
      const check = checkRateLimit(rateLimitKey as string);
      if (!check.allowed) {
        return res.status(429).json({ error: `Too many login attempts. Locked out. Try again in ${check.remainingSeconds}s.` });
      }

      const { rows } = await pool.query(
        'SELECT id, username, role, name, password_hash FROM users WHERE username = $1 LIMIT 1',
        [username]
      );
      const user = rows[0];

      if (!user || !user.password_hash) {
        const limitResult = recordFailure(rateLimitKey as string);
        if (limitResult.lockedOut) {
          return res.status(429).json({ error: 'Too many login attempts. Locked out for 60 seconds.' });
        }
        return res.status(401).json({ error: `Invalid username or password. (${limitResult.attempts}/5 attempts)` });
      }

      const isMatched = verifyPinHash(password, user.password_hash);
      if (!isMatched) {
        const limitResult = recordFailure(rateLimitKey as string);
        if (limitResult.lockedOut) {
          return res.status(429).json({ error: 'Too many login attempts. Locked out for 60 seconds.' });
        }
        return res.status(401).json({ error: `Invalid username or password. (${limitResult.attempts}/5 attempts)` });
      }

      recordSuccess(rateLimitKey as string);

      const payload = {
        id: user.id,
        username: user.username,
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
          username: user.username,
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

      const clientIp = getClientIp(req);
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
      const clientIp = getClientIp(req);
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
          username: decoded.username,
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
        const { rows } = await pool.query(
          'SELECT id, uid, username, role, name, photo_url, created_at FROM users ORDER BY created_at DESC'
        );
        return res.json({ users: rows || [] });
      }

      if (method === 'POST') {
        const username = String(req.body?.username || '').trim().toLowerCase();
        const role = String(req.body?.role || '').trim();
        const name = String(req.body?.name || '').trim();
        const password = String(req.body?.password || '').trim();

        if (!username || !role || !name || !password) {
          return res.status(400).json({ error: 'Username, role, name, and password are required.' });
        }

        if (username.length < 3) {
          return res.status(400).json({ error: 'Username must be at least 3 characters long.' });
        }

        const validRoles = ['super-admin', 'planner', 'leader', 'member', 'production-board'];
        if (!validRoles.includes(role)) {
          return res.status(400).json({ error: 'Invalid user role specified.' });
        }

        const uid = `uid-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
        const passHash = hashPin(password);
        try {
          const { rows } = await pool.query(
            'INSERT INTO users (uid, username, role, name, password_hash) VALUES ($1, $2, $3, $4, $5) RETURNING id, username, role, name, created_at',
            [uid, username, role, name, passHash]
          );
          return res.status(201).json({ success: true, user: rows[0] });
        } catch (err: any) {
          if (err.code === '23505') {
            return res.status(400).json({ error: 'Username already registered.' });
          }
          return res.status(500).json({ error: err.message });
        }
      }

      if (method === 'PUT') {
        const id = String(req.body?.id || '').trim();
        const username = String(req.body?.username || '').trim().toLowerCase();
        const role = String(req.body?.role || '').trim();
        const name = String(req.body?.name || '').trim();
        const password = String(req.body?.password || '').trim();

        if (!id || !username || !role || !name) {
          return res.status(400).json({ error: 'ID, username, role, and name are required.' });
        }

        if (username.length < 3) {
          return res.status(400).json({ error: 'Username must be at least 3 characters long.' });
        }

        const validRoles = ['super-admin', 'planner', 'leader', 'member', 'production-board'];
        if (!validRoles.includes(role)) {
          return res.status(400).json({ error: 'Invalid user role specified.' });
        }

        if (password) {
          const passHash = hashPin(password);
          const { rows } = await pool.query(
            'UPDATE users SET username = $1, role = $2, name = $3, password_hash = $4 WHERE id = $5 RETURNING id, username, role, name, created_at',
            [username, role, name, passHash, id]
          );
          return res.json({ success: true, user: rows[0] });
        } else {
          const { rows } = await pool.query(
            'UPDATE users SET username = $1, role = $2, name = $3 WHERE id = $4 RETURNING id, username, role, name, created_at',
            [username, role, name, id]
          );
          return res.json({ success: true, user: rows[0] });
        }
      }

      if (method === 'DELETE') {
        const id = String(req.body?.id || req.query?.id || '').trim();

        if (!id) {
          return res.status(400).json({ error: 'User ID is required for deletion.' });
        }

        if (id === decoded.id) {
          return res.status(400).json({ error: 'You cannot delete your own Super Admin account.' });
        }

        await pool.query('DELETE FROM users WHERE id = $1', [id]);
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
    try {
      await migrateLegacyPins();

      const name = String(req.body?.name || '').trim();
      const pin = String(req.body?.pin || '').trim();
      if (!name) return res.status(400).json({ error: 'Name is required.' });
      if (pin.length !== 4) return res.status(400).json({ error: 'PIN must be exactly 4 characters.' });
      if (pin === MASTER_LEADER_PIN) return res.status(409).json({ error: 'This PIN code is reserved.' });

      const { rows: existing } = await pool.query('SELECT id, pin, pin_hash FROM leaders');
      const duplicate = (existing || []).some(l => verifyPinHash(pin, l.pin_hash) || (l.pin && l.pin === pin));
      if (duplicate) return res.status(409).json({ error: 'This PIN code is already registered.' });

      const enc = encryptPin(pin);
      const { rows } = await pool.query(
        'INSERT INTO leaders (name, pin_hash, pin_encrypted) VALUES ($1, $2, $3) RETURNING id, name, created_at',
        [name, hashPin(pin), enc]
      );
      res.json({ leader: rows[0] || null });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Planner only: delete a leader by id.
  app.delete('/api/leaders/:id', async (req, res) => {
    if (!requireDb(res)) return;
    if (!requirePlannerAdmin(req, res)) return;
    try {
      await pool.query('DELETE FROM leaders WHERE id = $1', [req.params.id]);
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Planner only: reveal decrypted PINs for the registry screen.
  app.get('/api/leaders/pins', async (req, res) => {
    if (!requireDb(res)) return;
    if (!requirePlannerAdmin(req, res)) return;
    try {
      await migrateLegacyPins();
      const { rows } = await pool.query('SELECT id, name, pin, pin_encrypted FROM leaders');
      const pins = (rows || []).map(l => ({
        id: l.id,
        name: l.name,
        pin: decryptPin(l.pin_encrypted) || l.pin || null
      }));
      res.json({ pins, encryptionConfigured: !!getEncryptionKey() });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
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

  // ------------------------------------------------------------------
  // Master Parts APIs
  // ------------------------------------------------------------------
  app.get('/api/parts', async (_req, res) => {
    try {
      const { rows } = await pool.query('SELECT * FROM master_parts ORDER BY part_number ASC');
      res.json(rows || []);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post('/api/parts', async (req, res) => {
    try {
      const p = req.body;
      const query = `
        INSERT INTO master_parts (
          part_number, part_name, home_line, backup_line, model, sebango, material, area, tonnage, 
          cavity, mold, weight, shikake, spec, process, customer, customer_pno, customer_sebango,
          cycle_time, daily_requirement_n, daily_requirement_n1, daily_requirement_n2, daily_requirement_n3,
          month_n_forecast, month_n1_forecast, month_n2_forecast, month_n3_forecast, monthly_forecasts
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25, $26, $27, $28)
        ON CONFLICT (part_number) DO UPDATE SET
          part_name = EXCLUDED.part_name,
          home_line = EXCLUDED.home_line,
          backup_line = EXCLUDED.backup_line,
          model = EXCLUDED.model,
          sebango = EXCLUDED.sebango,
          material = EXCLUDED.material,
          area = EXCLUDED.area,
          tonnage = EXCLUDED.tonnage,
          cavity = EXCLUDED.cavity,
          mold = EXCLUDED.mold,
          weight = EXCLUDED.weight,
          shikake = EXCLUDED.shikake,
          spec = EXCLUDED.spec,
          process = EXCLUDED.process,
          customer = EXCLUDED.customer,
          customer_pno = EXCLUDED.customer_pno,
          customer_sebango = EXCLUDED.customer_sebango,
          cycle_time = EXCLUDED.cycle_time,
          daily_requirement_n = EXCLUDED.daily_requirement_n,
          daily_requirement_n1 = EXCLUDED.daily_requirement_n1,
          daily_requirement_n2 = EXCLUDED.daily_requirement_n2,
          daily_requirement_n3 = EXCLUDED.daily_requirement_n3,
          month_n_forecast = EXCLUDED.month_n_forecast,
          month_n1_forecast = EXCLUDED.month_n1_forecast,
          month_n2_forecast = EXCLUDED.month_n2_forecast,
          month_n3_forecast = EXCLUDED.month_n3_forecast,
          monthly_forecasts = EXCLUDED.monthly_forecasts
        RETURNING *
      `;
      const values = [
        p.part_number, p.part_name, p.home_line, p.backup_line, p.model, p.sebango, p.material, p.area, p.tonnage,
        p.cavity, p.mold, p.weight, p.shikake, p.spec, p.process, p.customer, p.customer_pno, p.customer_sebango,
        p.cycle_time || p.cycletime, p.daily_requirement_n, p.daily_requirement_n1, p.daily_requirement_n2, p.daily_requirement_n3,
        p.month_n_forecast, p.month_n1_forecast, p.month_n2_forecast, p.month_n3_forecast, JSON.stringify(p.monthly_forecasts || {})
      ];
      const { rows } = await pool.query(query, values);
      res.json(rows[0]);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post('/api/parts/import', async (req, res) => {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const payloads = req.body;
      for (const p of payloads) {
        const query = `
          INSERT INTO master_parts (
            part_number, part_name, home_line, backup_line, model, sebango, material, area, tonnage, 
            cavity, mold, weight, shikake, spec, process, customer, customer_pno, customer_sebango,
            cycle_time, daily_requirement_n, daily_requirement_n1, daily_requirement_n2, daily_requirement_n3,
            month_n_forecast, month_n1_forecast, month_n2_forecast, month_n3_forecast, monthly_forecasts
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25, $26, $27, $28)
          ON CONFLICT (part_number) DO UPDATE SET
            part_name = EXCLUDED.part_name,
            home_line = EXCLUDED.home_line,
            backup_line = EXCLUDED.backup_line,
            model = EXCLUDED.model,
            sebango = EXCLUDED.sebango,
            material = EXCLUDED.material,
            area = EXCLUDED.area,
            tonnage = EXCLUDED.tonnage,
            cavity = EXCLUDED.cavity,
            mold = EXCLUDED.mold,
            weight = EXCLUDED.weight,
            shikake = EXCLUDED.shikake,
            spec = EXCLUDED.spec,
            process = EXCLUDED.process,
            customer = EXCLUDED.customer,
            customer_pno = EXCLUDED.customer_pno,
            customer_sebango = EXCLUDED.customer_sebango,
            cycle_time = EXCLUDED.cycle_time,
            daily_requirement_n = EXCLUDED.daily_requirement_n,
            daily_requirement_n1 = EXCLUDED.daily_requirement_n1,
            daily_requirement_n2 = EXCLUDED.daily_requirement_n2,
            daily_requirement_n3 = EXCLUDED.daily_requirement_n3,
            month_n_forecast = EXCLUDED.month_n_forecast,
            month_n1_forecast = EXCLUDED.month_n1_forecast,
            month_n2_forecast = EXCLUDED.month_n2_forecast,
            month_n3_forecast = EXCLUDED.month_n3_forecast,
            monthly_forecasts = EXCLUDED.monthly_forecasts
        `;
        const values = [
          p.part_number, p.part_name, p.home_line, p.backup_line, p.model, p.sebango, p.material, p.area, p.tonnage,
          p.cavity, p.mold, p.weight, p.shikake, p.spec, p.process, p.customer, p.customer_pno, p.customer_sebango,
          p.cycle_time || p.cycletime, p.daily_requirement_n, p.daily_requirement_n1, p.daily_requirement_n2, p.daily_requirement_n3,
          p.month_n_forecast, p.month_n1_forecast, p.month_n2_forecast, p.month_n3_forecast, JSON.stringify(p.monthly_forecasts || {})
        ];
        await client.query(query, values);
      }
      await client.query('COMMIT');
      res.json({ success: true, count: payloads.length });
    } catch (error: any) {
      await client.query('ROLLBACK');
      res.status(500).json({ error: error.message });
    } finally {
      client.release();
    }
  });

  app.delete('/api/parts/:part_number', async (req, res) => {
    try {
      const { part_number } = req.params;
      await pool.query('DELETE FROM master_parts WHERE part_number = $1', [part_number]);
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.delete('/api/parts', async (_req, res) => {
    try {
      await pool.query("DELETE FROM master_parts WHERE id != '00000000-0000-0000-0000-000000000000'::uuid");
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // ------------------------------------------------------------------
  // History Orders APIs
  // ------------------------------------------------------------------
  app.get('/api/history-orders', async (_req, res) => {
    try {
      const { rows } = await pool.query('SELECT * FROM history_orders ORDER BY created_at DESC');
      res.json(rows || []);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post('/api/history-orders', async (req, res) => {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const rows = req.body;
      for (const r of rows) {
        const query = `
          INSERT INTO history_orders (
            batch_id, created_at, sebango, part_number, part_name, 
            month_n_volume, month_n1_volume, month_n2_volume, month_n3_volume, 
            daily_requirement_n, daily_requirement_n1, daily_requirement_n2, daily_requirement_n3
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
        `;
        const values = [
          r.batch_id, r.created_at, r.sebango, r.part_number, r.part_name,
          r.month_n_volume, r.month_n1_volume, r.month_n2_volume, r.month_n3_volume,
          r.daily_requirement_n, r.daily_requirement_n1, r.daily_requirement_n2, r.daily_requirement_n3
        ];
        await client.query(query, values);
      }
      await client.query('COMMIT');
      res.json({ success: true, count: rows.length });
    } catch (error: any) {
      await client.query('ROLLBACK');
      res.status(500).json({ error: error.message });
    } finally {
      client.release();
    }
  });

  // ------------------------------------------------------------------
  // Production Plans APIs
  // ------------------------------------------------------------------
  app.get('/api/production-plans', async (_req, res) => {
    try {
      const { rows } = await pool.query('SELECT * FROM production_plans');
      res.json(rows || []);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post('/api/production-plans', async (req, res) => {
    try {
      const plan = req.body;
      const query = `
        INSERT INTO production_plans (
          id, plan_type, machine_id, date_key, jobs, day_ot, night_ot,
          is_abnormal, abnormal_type, abnormal_start, is_ng, ng_type, ng_start, logs
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
        ON CONFLICT (id) DO UPDATE SET
          plan_type = EXCLUDED.plan_type,
          machine_id = EXCLUDED.machine_id,
          date_key = EXCLUDED.date_key,
          jobs = EXCLUDED.jobs,
          day_ot = EXCLUDED.day_ot,
          night_ot = EXCLUDED.night_ot,
          is_abnormal = EXCLUDED.is_abnormal,
          abnormal_type = EXCLUDED.abnormal_type,
          abnormal_start = EXCLUDED.abnormal_start,
          is_ng = EXCLUDED.is_ng,
          ng_type = EXCLUDED.ng_type,
          ng_start = EXCLUDED.ng_start,
          logs = EXCLUDED.logs,
          updated_at = NOW()
        RETURNING *
      `;
      const values = [
        plan.id, plan.plan_type, plan.machine_id, plan.date_key, JSON.stringify(plan.jobs || []),
        plan.day_ot || 'teiji', plan.night_ot || 'teiji',
        plan.is_abnormal || false, plan.abnormal_type || null, plan.abnormal_start || null,
        plan.is_ng || false, plan.ng_type || null, plan.ng_start || null,
        JSON.stringify(plan.logs || [])
      ];
      const { rows } = await pool.query(query, values);
      const updatedPlan = rows[0];

      // Broadcast update to all Socket.io clients
      io.emit('production_plan_updated', updatedPlan);

      res.json(updatedPlan);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // ------------------------------------------------------------------
  // Label Counters APIs
  // ------------------------------------------------------------------
  app.get('/api/label-counters/:date_key', async (req, res) => {
    try {
      const { date_key } = req.params;
      const { rows } = await pool.query('SELECT seq FROM label_counters WHERE date_key = $1', [date_key]);
      if (rows.length > 0) {
        res.json({ seq: rows[0].seq });
      } else {
        res.json({ seq: 0 });
      }
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post('/api/label-counters', async (req, res) => {
    try {
      const { date_key, seq } = req.body;
      const query = `
        INSERT INTO label_counters (date_key, seq, updated_at)
        VALUES ($1, $2, NOW())
        ON CONFLICT (date_key) DO UPDATE SET
          seq = EXCLUDED.seq,
          updated_at = NOW()
        RETURNING *
      `;
      const { rows } = await pool.query(query, [date_key, seq]);
      res.json(rows[0]);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
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

  // Socket.io & HTTP server initialization
  const server = http.createServer(app);
  const io = new Server(server, {
    cors: {
      origin: "*",
      methods: ["GET", "POST"]
    }
  });

  io.on('connection', (socket) => {
    console.log('Client connected:', socket.id);
    socket.on('disconnect', () => {
      console.log('Client disconnected:', socket.id);
    });
  });

  server.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
