-- Migration 008: Feed Experience Controls
-- 1. Explicitly define blocked_users table
-- 2. Define not_interested table
-- 3. Apply RLS and indexes

-- ───────────────────────────────────────────────────────────
-- A. blocked_users
-- ───────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS blocked_users (
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    blocked_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT now(),
    PRIMARY KEY (user_id, blocked_user_id)
);

ALTER TABLE blocked_users ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "blocked_users: users manage own" ON blocked_users;
CREATE POLICY "blocked_users: users manage own"
    ON blocked_users FOR ALL
    TO authenticated
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_blocked_user_id ON blocked_users(user_id);

-- ───────────────────────────────────────────────────────────
-- B. not_interested (Creator Suppression)
-- ───────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS not_interested (
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    creator_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT now(),
    PRIMARY KEY (user_id, creator_id)
);

ALTER TABLE not_interested ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "not_interested: users manage own" ON not_interested;
CREATE POLICY "not_interested: users manage own"
    ON not_interested FOR ALL
    TO authenticated
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_not_interested_user ON not_interested(user_id);
