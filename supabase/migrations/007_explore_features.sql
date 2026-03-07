-- Migration 007: Performance Indexes
-- 1. Add index for audio page querying speed

CREATE INDEX IF NOT EXISTS idx_videos_audio_id ON videos(audio_id);
