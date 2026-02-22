// /api/admin.js — admin dashboard data, password protected (CommonJS for Vercel)
module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;
  const SUPABASE_URL = process.env.SUPABASE_URL;
  const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;

  const body = req.body || {};
  const { password, action } = body;

  if (!ADMIN_PASSWORD || password !== ADMIN_PASSWORD) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    return res.status(500).json({ error: 'Supabase service key not configured. Add SUPABASE_URL and SUPABASE_SERVICE_KEY to Vercel environment variables.' });
  }

  const headers = {
    'apikey': SUPABASE_SERVICE_KEY,
    'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
    'Content-Type': 'application/json'
  };

  try {
    if (action === 'overview') {
      const [usersR, statsR, authR] = await Promise.all([
        fetch(`${SUPABASE_URL}/rest/v1/users?select=*&order=created_at.desc`, { headers }),
        fetch(`${SUPABASE_URL}/rest/v1/user_stats?select=*&order=last_active.desc`, { headers }),
        fetch(`${SUPABASE_URL}/auth/v1/admin/users?per_page=500`, { headers })
      ]);

      const users = usersR.ok ? await usersR.json() : [];
      const stats = statsR.ok ? await statsR.json() : [];
      const authData = authR.ok ? await authR.json() : { users: [] };
      const authUsers = Array.isArray(authData) ? authData : (authData.users || []);

      const merged = authUsers.map(au => {
        const profile = users.find(u => u.id === au.id) || {};
        const stat = stats.find(s => s.user_id === au.id) || {};
        return {
          id: au.id,
          email: au.email,
          provider: (au.app_metadata && au.app_metadata.provider) || 'email',
          confirmed: !!au.email_confirmed_at,
          created_at: au.created_at,
          last_sign_in: au.last_sign_in_at,
          subject: profile.subject || stat.subject || '',
          questions_used: stat.questions_used || 0,
          sessions_count: stat.sessions_count || 0,
          last_active: stat.last_active || au.last_sign_in_at
        };
      });

      const now = Date.now();
      const day = 86400000;
      const totalUsers = merged.length;
      const confirmedUsers = merged.filter(u => u.confirmed).length;
      const activeToday = merged.filter(u => u.last_active && (now - new Date(u.last_active)) < day).length;
      const activeWeek = merged.filter(u => u.last_active && (now - new Date(u.last_active)) < 7 * day).length;
      const totalQuestions = merged.reduce((s, u) => s + (u.questions_used || 0), 0);
      const totalSessions = merged.reduce((s, u) => s + (u.sessions_count || 0), 0);

      const signupsByDay = {};
      merged.forEach(u => {
        if (!u.created_at) return;
        const d = u.created_at.substring(0, 10);
        signupsByDay[d] = (signupsByDay[d] || 0) + 1;
      });
      const signupChart = Object.entries(signupsByDay)
        .sort(([a], [b]) => a.localeCompare(b))
        .slice(-30)
        .map(([date, count]) => ({ date, count }));

      const subjectMap = {};
      merged.forEach(u => {
        const s = ((u.subject || 'Unknown').split('\u2014')[0].trim().split(',')[0].trim()) || 'Unknown';
        subjectMap[s] = (subjectMap[s] || 0) + 1;
      });
      const subjects = Object.entries(subjectMap)
        .sort(([, a], [, b]) => b - a)
        .slice(0, 15)
        .map(([name, count]) => ({ name, count }));

      const providerMap = {};
      merged.forEach(u => { providerMap[u.provider] = (providerMap[u.provider] || 0) + 1; });

      return res.status(200).json({
        summary: { totalUsers, confirmedUsers, activeToday, activeWeek, totalQuestions, totalSessions },
        users: merged,
        signupChart,
        subjects,
        providers: providerMap
      });
    }

    if (action === 'delete_user') {
      const { userId } = body;
      if (!userId) return res.status(400).json({ error: 'userId required' });
      const r = await fetch(`${SUPABASE_URL}/auth/v1/admin/users/${userId}`, {
        method: 'DELETE',
        headers
      });
      return res.status(r.ok ? 200 : 400).json({ ok: r.ok });
    }

    return res.status(400).json({ error: 'Unknown action' });

  } catch (err) {
    console.error('Admin error:', err);
    return res.status(500).json({ error: err.message });
  }
};
