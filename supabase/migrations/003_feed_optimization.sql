-- Migration 003: Feed Optimization
-- Run AFTER migration 002.
--
-- Changes:
--   a) blocked_users table
--   b) Performance indexes on videos, likes, bookmarks

-- ───────────────────────────────────────────────────────────
-- A. Blocked users table
-- ───────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS blocked_users (
    user_id          UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    blocked_user_id  UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (user_id, blocked_user_id)
);

ALTER TABLE blocked_users ENABLE ROW LEVEL SECURITY;

-- Users can only manage their own block list
CREATE POLICY "blocked_users: users manage own"
    ON blocked_users FOR ALL
    TO authenticated
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- ───────────────────────────────────────────────────────────
-- B. Performance indexes
-- ───────────────────────────────────────────────────────────

-- Feed cursor pagination — orders by created_at DESC
CREATE INDEX IF NOT EXISTS idx_videos_created_at
    ON videos (created_at DESC);

-- Like lookups — check if user liked a video
CREATE INDEX IF NOT EXISTS idx_likes_user_video
    ON likes (user_id, video_id);

-- Bookmark lookups — check if user bookmarked a video
CREATE INDEX IF NOT EXISTS idx_bookmarks_user_video
    ON bookmarks (user_id, video_id);

-- Block list lookups — filter feed by blocked users
CREATE INDEX IF NOT EXISTS idx_blocked_users_user_id
    ON blocked_users (user_id);
