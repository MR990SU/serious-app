-- Migration 002: New Feature Tables and Columns
-- Run AFTER migration 001.
--
-- Changes in this file:
--   a) bookmarks table (save/unsave reels)
--   b) videos.comments_enabled column (enable/disable comments per video)
--   c) RLS policy to block comment inserts when comments_enabled = false

-- ───────────────────────────────────────────────────────────
-- A. Bookmarks table
-- ───────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS bookmarks (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    video_id    UUID NOT NULL REFERENCES videos(id) ON DELETE CASCADE,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (user_id, video_id)
);

ALTER TABLE bookmarks ENABLE ROW LEVEL SECURITY;

-- Users can only see, add, or remove their own bookmarks
CREATE POLICY "bookmarks: users manage own"
    ON bookmarks FOR ALL
    TO authenticated
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- ───────────────────────────────────────────────────────────
-- B. comments_enabled column on videos
-- ───────────────────────────────────────────────────────────
ALTER TABLE videos
    ADD COLUMN IF NOT EXISTS comments_enabled BOOLEAN NOT NULL DEFAULT true;

-- ───────────────────────────────────────────────────────────
-- C. RLS policy: block comment inserts when comments are disabled
-- ───────────────────────────────────────────────────────────
-- NOTE: This policy requires that the existing `videos` UPDATE RLS policy
-- already restricts updates to auth.uid() = user_id.
-- Only the owner of a video can set comments_enabled = false,
-- so a non-owner who tries to comment on a video where comments are
-- disabled will be rejected here.
--
-- Apply DROP before CREATE in case this migration is re-run:
DROP POLICY IF EXISTS "comments: block when disabled" ON comments;

CREATE POLICY "comments: block when disabled"
    ON comments FOR INSERT
    TO authenticated
    WITH CHECK (
        EXISTS (
            SELECT 1
            FROM videos
            WHERE videos.id = video_id
              AND videos.comments_enabled = true
        )
    );

-- ───────────────────────────────────────────────────────────
-- D. Recommended indexes
-- ───────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_bookmarks_user_id  ON bookmarks (user_id);
CREATE INDEX IF NOT EXISTS idx_bookmarks_video_id ON bookmarks (video_id);
