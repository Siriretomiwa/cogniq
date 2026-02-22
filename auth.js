// /api/auth.js — Supabase auth proxy (CommonJS for Vercel)
module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const SUPABASE_URL = process.env.SUPABASE_URL;
  const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;
  const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;

  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    return res.status(500).json({ error: 'Supabase not configured. Add SUPABASE_URL and SUPABASE_ANON_KEY to Vercel environment variables.' });
  }

  const body = req.body || {};
  const { action, email, password, access_token, user_metadata } = body;

  try {

    if (action === 'signup') {
      const r = await fetch(`${SUPABASE_URL}/auth/v1/signup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'apikey': SUPABASE_ANON_KEY },
        body: JSON.stringify({ email, password, data: user_metadata || {} })
      });
      const data = await r.json();
      if (!r.ok) return res.status(400).json({ error: data.msg || data.error_description || data.message || 'Signup failed' });
      const needsConfirmation = !data.session;
      if (data.user && SUPABASE_SERVICE_KEY) await upsertUser(SUPABASE_URL, SUPABASE_SERVICE_KEY, data.user, user_metadata || {});
      return res.status(200).json({ user: data.user, session: data.session, needsConfirmation });
    }

    if (action === 'signin') {
      const r = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'apikey': SUPABASE_ANON_KEY },
        body: JSON.stringify({ email, password })
      });
      const data = await r.json();
      if (!r.ok) return res.status(400).json({ error: data.error_description || data.msg || data.message || 'Sign in failed. Check your email and password.' });
      if (data.user && SUPABASE_SERVICE_KEY) await upsertUser(SUPABASE_URL, SUPABASE_SERVICE_KEY, data.user, {});
      return res.status(200).json({ user: data.user, session: data });
    }

    if (action === 'magic') {
      const r = await fetch(`${SUPABASE_URL}/auth/v1/otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'apikey': SUPABASE_ANON_KEY },
        body: JSON.stringify({ email, create_user: true })
      });
      const data = await r.json();
      if (!r.ok) return res.status(400).json({ error: data.msg || data.message || 'Failed to send magic link' });
      return res.status(200).json({ sent: true });
    }

    if (action === 'oauth_google') {
      const origin = req.headers.origin || '';
      const redirectUrl = origin + '/?auth_callback=google';
      const url = `${SUPABASE_URL}/auth/v1/authorize?provider=google&redirect_to=${encodeURIComponent(redirectUrl)}`;
      return res.status(200).json({ url });
    }

    if (action === 'verify') {
      if (!access_token) return res.status(401).json({ error: 'No token provided' });
      const r = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
        headers: { 'Authorization': `Bearer ${access_token}`, 'apikey': SUPABASE_ANON_KEY }
      });
      const data = await r.json();
      if (!r.ok) return res.status(401).json({ error: 'Session expired or invalid' });
      return res.status(200).json({ user: data });
    }

    if (action === 'track') {
      const { userId, subject, questionsUsed, sessionsCount } = body;
      if (!userId || !SUPABASE_SERVICE_KEY) return res.status(200).json({ ok: true });
      await fetch(`${SUPABASE_URL}/rest/v1/user_stats`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': SUPABASE_SERVICE_KEY,
          'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
          'Prefer': 'resolution=merge-duplicates'
        },
        body: JSON.stringify({
          user_id: userId,
          subject: subject || '',
          questions_used: questionsUsed || 0,
          sessions_count: sessionsCount || 0,
          last_active: new Date().toISOString()
        })
      });
      return res.status(200).json({ ok: true });
    }

    return res.status(400).json({ error: 'Unknown action: ' + action });

  } catch (err) {
    console.error('Auth error:', err);
    return res.status(500).json({ error: err.message });
  }
};

async function upsertUser(url, serviceKey, user, metadata) {
  try {
    await fetch(`${url}/rest/v1/users`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': serviceKey,
        'Authorization': `Bearer ${serviceKey}`,
        'Prefer': 'resolution=merge-duplicates'
      },
      body: JSON.stringify({
        id: user.id,
        email: user.email,
        subject: metadata.subject || '',
        created_at: user.created_at || new Date().toISOString(),
        last_sign_in: new Date().toISOString()
      })
    });
  } catch (e) {
    console.error('upsertUser error:', e.message);
  }
}
