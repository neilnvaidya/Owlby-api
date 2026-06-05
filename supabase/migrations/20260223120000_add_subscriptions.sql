-- Subscriptions, free tier & early adopters (backlog item 1)
-- Adds: user_subscription, user_usage_daily, users.is_early_adopter, increment RPC.

-- 1. user_subscription — one row per user, upserted by RevenueCat webhook
CREATE TABLE IF NOT EXISTS user_subscription (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id TEXT NOT NULL,
  product_id TEXT NOT NULL,
  entitlement_id TEXT NOT NULL DEFAULT 'premium',
  platform TEXT CHECK (platform IN ('ios', 'android')),
  revenuecat_original_app_user_id TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  expires_at TIMESTAMPTZ,
  store TEXT,
  event_type TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS user_subscription_user_id_idx
  ON user_subscription(user_id);

CREATE INDEX IF NOT EXISTS user_subscription_active_idx
  ON user_subscription(user_id) WHERE is_active = true;

-- 2. user_usage_daily — daily generation counts for free-tier caps
CREATE TABLE IF NOT EXISTS user_usage_daily (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id TEXT NOT NULL,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  chat_count INTEGER NOT NULL DEFAULT 0,
  lesson_count INTEGER NOT NULL DEFAULT 0,
  story_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS user_usage_daily_user_date_idx
  ON user_usage_daily(user_id, date);

-- 3. Early adopter flag on users table
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS is_early_adopter BOOLEAN NOT NULL DEFAULT false;

-- 4. RPC: atomic increment of the correct daily counter (avoids race conditions)
CREATE OR REPLACE FUNCTION increment_daily_usage(
  p_user_id TEXT,
  p_date DATE,
  p_route TEXT
) RETURNS VOID AS $$
BEGIN
  INSERT INTO user_usage_daily (user_id, date, chat_count, lesson_count, story_count)
  VALUES (
    p_user_id,
    p_date,
    CASE WHEN p_route = 'chat' THEN 1 ELSE 0 END,
    CASE WHEN p_route = 'lesson' THEN 1 ELSE 0 END,
    CASE WHEN p_route = 'story' THEN 1 ELSE 0 END
  )
  ON CONFLICT (user_id, date) DO UPDATE SET
    chat_count = user_usage_daily.chat_count + CASE WHEN p_route = 'chat' THEN 1 ELSE 0 END,
    lesson_count = user_usage_daily.lesson_count + CASE WHEN p_route = 'lesson' THEN 1 ELSE 0 END,
    story_count = user_usage_daily.story_count + CASE WHEN p_route = 'story' THEN 1 ELSE 0 END,
    updated_at = NOW();
END;
$$ LANGUAGE plpgsql;
