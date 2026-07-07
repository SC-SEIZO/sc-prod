import crypto from 'crypto';

const JWT_SECRET = process.env.JWT_SECRET || 'sugity-default-secret-key-123456';

function parseCookies(cookieHeader: string | undefined): Record<string, string> {
  const list: Record<string, string> = {};
  if (!cookieHeader) return list;
  cookieHeader.split(';').forEach((cookie) => {
    const parts = cookie.split('=');
    list[parts.shift()!.trim()] = decodeURIComponent(parts.join('='));
  });
  return list;
}

function verifyJwt(token: string, secret: string): any {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const [headerB64, payloadB64, signatureB64] = parts;
    
    // Verify signature
    const hmac = crypto.createHmac('sha256', secret);
    hmac.update(`${headerB64}.${payloadB64}`);
    const expectedSignature = hmac.digest('base64url');
    if (signatureB64 !== expectedSignature) return null;

    const payloadStr = Buffer.from(payloadB64, 'base64url').toString('utf8');
    const payload = JSON.parse(payloadStr);

    if (payload.exp && Date.now() / 1000 > payload.exp) {
      return null;
    }
    return payload;
  } catch {
    return null;
  }
}

export default async function handler(req: any, res: any) {
  try {
    if (req.method !== 'GET') {
      return res.status(405).json({ error: 'Method not allowed' });
    }

    const cookies = parseCookies(req.headers.cookie);
    const token = cookies['sugity_session'];

    if (!token) {
      return res.json({ authenticated: false });
    }

    const decoded = verifyJwt(token, JWT_SECRET);
    if (!decoded) {
      return res.json({ authenticated: false });
    }

    return res.json({
      authenticated: true,
      user: {
        email: decoded.email,
        role: decoded.role,
        name: decoded.name
      }
    });
  } catch (err: any) {
    console.error('[/api/auth/me] Unhandled error:', err);
    return res.status(500).json({ error: err?.message || 'Internal server error' });
  }
}
