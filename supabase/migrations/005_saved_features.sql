-- Migration 005: Saved Reels & Saved Audio
-- 1. Create saved_audio table
-- 2. Add necessary composite and timestamp indexes for pagination
-- 3. Add missing index for bookmarks (saved reels)

CREATE TABLE IF NOT EXISTS saved_audio (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    audio_id UUID NOT NULL REFERENCES audio(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE (user_id, audio_id)
);

-- Enable RLS
ALTER TABLE saved_audio ENABLE ROW LEVEL SECURITY;

-- Policy: Users can only manage their own saved audio
CREATE POLICY "saved_audio: users manage own"
    ON saved_audio FOR ALL
    TO authenticated
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- Indexes for saved_audio
CREATE INDEX IF NOT EXISTS idx_saved_audio_user_audio ON saved_audio(user_id, audio_id);
CREATE INDEX IF NOT EXISTS idx_saved_audio_created ON saved_audio(created_at DESC);

-- Missing index for bookmarks (Saved Reels) to speed up profile tab loading
CREATE INDEX IF NOT EXISTS idx_bookmarks_user_video ON bookmarks(user_id, video_id);
