# Cognio Auth + Admin Setup Guide
## ~20 minutes total

---

## Step 1 — Create a Supabase project (5 min)

1. Go to **https://supabase.com** → New project
2. Name it `cognio`, choose a strong database password, pick your region
3. Wait ~2 min for it to provision

---

## Step 2 — Run the database schema (2 min)

1. In your Supabase dashboard → **SQL Editor** → **New query**
2. Paste the entire contents of `supabase-setup.sql`
3. Click **Run** — you should see "Success"

---

## Step 3 — Get your API keys (1 min)

In Supabase → **Settings** → **API**:

| Key | Where to find it |
|-----|-----------------|
| `SUPABASE_URL` | "Project URL" (e.g. `https://abcxyz.supabase.co`) |
| `SUPABASE_ANON_KEY` | "anon public" key |
| `SUPABASE_SERVICE_KEY` | "service_role" key (keep secret!) |

---

## Step 4 — Enable Google OAuth (optional, 5 min)

1. Go to **https://console.cloud.google.com** → APIs & Services → Credentials
2. Create an **OAuth 2.0 Client ID** (Web application type)
3. Add Authorized redirect URI: `https://YOUR-PROJECT.supabase.co/auth/v1/callback`
4. Copy the Client ID and Client Secret
5. In Supabase → **Authentication** → **Providers** → **Google** → Enable → paste keys

---

## Step 5 — Add environment variables to Vercel (3 min)

In your Vercel project → **Settings** → **Environment Variables**, add:

| Variable | Value |
|----------|-------|
| `SUPABASE_URL` | Your project URL |
| `SUPABASE_ANON_KEY` | Your anon key |
| `SUPABASE_SERVICE_KEY` | Your service role key |
| `ADMIN_PASSWORD` | A strong password only you know (e.g. `Cognio$Admin2025!`) |

Then **redeploy** (Vercel → Deployments → Redeploy).

---

## Step 6 — Configure email confirmations (optional)

In Supabase → **Authentication** → **Email Templates**:
- Customize the confirmation email with your branding
- By default, users get a confirmation email before they can log in
- To skip confirmation (allow instant signup): **Auth** → **Settings** → disable "Enable email confirmations"

---

## Step 7 — Access your admin dashboard

Go to: `https://your-app.vercel.app/admin`

Enter the `ADMIN_PASSWORD` you set in Vercel.

You'll see:
- 📊 Total users, active today/this week
- 📈 Signup chart (last 30 days)
- 🎓 Top subjects being studied
- 🔑 Sign-in method breakdown (email/Google/magic link)
- 👥 Full user table with filtering + CSV export
- 🗑️ Delete users if needed

---

## How auth works in the app

```
User visits app
  ↓
No valid session? → Auth screen (Sign In / Create Account / Magic Link / Google)
  ↓
Valid session? → Skip auth → Dashboard (or Onboarding if first time)
  ↓
Every 5 min → Silently tracks subject + question count to admin dashboard
  ↓
Settings screen → Sign Out button clears session → back to auth
```

---

## Files added/changed

```
api/auth.js          — Handles all auth actions (signup, signin, magic link, OAuth, verify, track)
api/admin.js         — Admin data endpoint (password protected)
admin.html           — Full admin dashboard UI
supabase-setup.sql   — Run this once in Supabase SQL editor
vercel.json          — Updated: /admin route added
index.html           — Auth screen + JS injected
```

---

## Troubleshooting

**"Supabase not configured"** → You haven't added the env vars to Vercel yet. Add them + redeploy.

**Users can sign up but not log in** → Email confirmation is enabled. Either confirm via email, or disable it in Supabase Auth settings.

**Google button not working** → OAuth provider not enabled in Supabase, or redirect URI not added to Google Cloud Console.

**Admin dashboard says "Unauthorized"** → Wrong password, or `ADMIN_PASSWORD` env var not set in Vercel.

**Admin shows 0 users but signups happened** → The `users` table trigger might not have run. Re-run `supabase-setup.sql` in the SQL editor.
