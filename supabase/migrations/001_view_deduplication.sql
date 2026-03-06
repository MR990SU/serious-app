-- Migration 001: View Deduplication
-- Prevents unbounded view inserts from the same user/anonymous visitor per day.
--
-- IMPORTANT: Run this migration BEFORE deploying the updated incrementViewCount action.
-- The cleanup step (Step 3) is safe to re-run; it will simply delete no rows on a clean table.

-- Step 1: Add anon_identifier column for anonymous deduplication
ALTER TABLE views ADD COLUMN IF NOT EXISTS anon_identifier TEXT;

-- Step 2: Remove duplicate authenticated views — keep the earliest row per (video_id, user_id, day)
DELETE FROM views a
USING views b
WHERE a.id > b.id
  AND a.video_id  = b.video_id
  AND a.user_id IS NOT NULL
  AND a.user_id  = b.user_id
  AND DATE(a.created_at) = DATE(b.created_at);

-- Step 3: Add partial unique index for authenticated views (one view per user per video per day)
-- Using a partial index keeps the constraint narrow and the index small.
CREATE UNIQUE INDEX IF NOT EXISTS idx_views_user_video_date
  ON views (video_id, user_id, DATE(created_at))
  WHERE user_id IS NOT NULL;

-- Step 4: Add partial unique index for anonymous views (dedup by hashed IP per video per day)
CREATE UNIQUE INDEX IF NOT EXISTS idx_views_anon_video_date
  ON views (video_id, anon_identifier, DATE(created_at))
  WHERE anon_identifier IS NOT NULL;

-- Step 5: General performance index for querying views by video
CREATE INDEX IF NOT EXISTS idx_views_video_id
  ON views (video_id);
