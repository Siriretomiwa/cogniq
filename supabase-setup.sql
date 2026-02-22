-- ═══════════════════════════════════════════
-- COGNIO SUPABASE SETUP
-- Run this entire file in your Supabase SQL editor
-- Dashboard → SQL Editor → New query → paste → Run
-- ═══════════════════════════════════════════

-- 1. Users profile table (mirrors auth.users)
CREATE TABLE IF NOT EXISTS public.users (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  subject TEXT DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  last_sign_in TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Usage stats table
CREATE TABLE IF NOT EXISTS public.user_stats (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  subject TEXT DEFAULT '',
  questions_used INTEGER DEFAULT 0,
  sessions_count INTEGER DEFAULT 0,
  last_active TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Row Level Security — users can only read/write their own data
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_stats ENABLE ROW LEVEL SECURITY;

-- Allow service role (admin API) full access
CREATE POLICY "Service role full access on users"
  ON public.users FOR ALL
  USING (auth.role() = 'service_role');

CREATE POLICY "Service role full access on user_stats"
  ON public.user_stats FOR ALL
  USING (auth.role() = 'service_role');

-- Allow users to read/update their own profile
CREATE POLICY "Users can view own profile"
  ON public.users FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Users can update own profile"
  ON public.users FOR UPDATE
  USING (auth.uid() = id);

CREATE POLICY "Users can view own stats"
  ON public.user_stats FOR SELECT
  USING (auth.uid() = user_id);

-- 4. Auto-create profile on signup (via trigger)
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.users (id, email, created_at)
  VALUES (NEW.id, NEW.email, NEW.created_at)
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 5. Enable Google OAuth (do this in Auth → Providers in Supabase Dashboard, not SQL)
-- ✓ Go to Authentication → Providers → Google → Enable
-- ✓ Add your Google OAuth Client ID + Secret (from Google Cloud Console)

-- Done! Your tables are ready.
