-- Migration 004: Media and Audio Support
-- Changes:
--   a) New 'audio' table with idx_audio_created_at
--   b) Update 'videos' table (media_type, audio_id)
--   c) Trigger to auto-increment audio.used_count
--   d) Storage buckets and RLS policies

-- ───────────────────────────────────────────────────────────
-- A. Audio table
-- ───────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS audio (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,
    artist TEXT NOT NULL,
    audio_url TEXT NOT NULL,
    used_count INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_audio_created_at ON audio(created_at DESC);

-- ───────────────────────────────────────────────────────────
-- B. Update videos table
-- ───────────────────────────────────────────────────────────
ALTER TABLE videos 
  ADD COLUMN IF NOT EXISTS media_type TEXT NOT NULL DEFAULT 'video' CHECK (media_type IN ('video', 'photo')),
  ADD COLUMN IF NOT EXISTS audio_id UUID REFERENCES audio(id) ON DELETE SET NULL;

-- ───────────────────────────────────────────────────────────
-- C. Auto-increment used_count trigger
-- ───────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION increment_audio_used_count()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.audio_id IS NOT NULL THEN
        UPDATE audio 
        SET used_count = used_count + 1 
        WHERE id = NEW.audio_id;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_increment_audio_used_count ON videos;
CREATE TRIGGER trigger_increment_audio_used_count
AFTER INSERT ON videos
FOR EACH ROW
EXECUTE FUNCTION increment_audio_used_count();

-- ───────────────────────────────────────────────────────────
-- D. Storage Buckets & Policies
-- ───────────────────────────────────────────────────────────
-- Insert buckets if they don't exist
INSERT INTO storage.buckets (id, name, public) 
VALUES ('reels-media', 'reels-media', true)
ON CONFLICT (id) DO NOTHING;

INSERT INTO storage.buckets (id, name, public) 
VALUES ('audio-library', 'audio-library', true)
ON CONFLICT (id) DO NOTHING;

-- RLS for reels-media
CREATE POLICY "authenticated upload reels-media"
    ON storage.objects FOR INSERT
    TO authenticated
    WITH CHECK (bucket_id = 'reels-media');

CREATE POLICY "public read reels-media"
    ON storage.objects FOR SELECT
    TO public
    USING (bucket_id = 'reels-media');

-- RLS for audio-library
CREATE POLICY "authenticated upload audio-library"
    ON storage.objects FOR INSERT
    TO authenticated
    WITH CHECK (bucket_id = 'audio-library');

CREATE POLICY "public read audio-library"
    ON storage.objects FOR SELECT
    TO public
    USING (bucket_id = 'audio-library');
