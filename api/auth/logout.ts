export default async function handler(req: any, res: any) {
  try {
    if (req.method !== 'POST') {
      return res.status(405).json({ error: 'Method not allowed' });
    }

    // Set cookie with Max-Age=0 to delete it
    res.setHeader('Set-Cookie', 'sugity_session=; Path=/; Max-Age=0; HttpOnly; SameSite=Lax');
    return res.json({ success: true });
  } catch (err: any) {
    console.error('[/api/auth/logout] Unhandled error:', err);
    return res.status(500).json({ error: err?.message || 'Internal server error' });
  }
}
