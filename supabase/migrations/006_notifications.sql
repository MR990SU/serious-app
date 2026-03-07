-- Migration 006: Notifications & Liked Reels Updates
-- 1. Create notifications table
-- 2. Add performance index on likes table
-- 3. Add trigger to automatically create 'like' notifications

CREATE TABLE IF NOT EXISTS notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    actor_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    type TEXT NOT NULL, -- 'like', 'comment', 'follow'
    video_id UUID REFERENCES videos(id) ON DELETE CASCADE, 
    seen BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- Policy: Users can only see and manage their own notifications
CREATE POLICY "notifications: users manage own"
    ON notifications FOR ALL
    TO authenticated
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- Performance Indexes
CREATE INDEX IF NOT EXISTS idx_notifications_user_created ON notifications(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_likes_user_created ON likes(user_id, created_at DESC);

-- Automated Notification Triggers
-- 1. Like Notification trigger (prevent self-likes from notifying)
CREATE OR REPLACE FUNCTION handle_new_like()
RETURNS trigger AS $$
DECLARE
    v_owner_id UUID;
BEGIN
    SELECT user_id INTO v_owner_id 
    FROM videos 
    WHERE id = NEW.video_id 
    LIMIT 1;

    IF v_owner_id != NEW.user_id THEN
        INSERT INTO notifications (user_id, actor_id, type, video_id)
        VALUES (v_owner_id, NEW.user_id, 'like', NEW.video_id);
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Drop trigger if it exists to allow re-running migration safely
DROP TRIGGER IF EXISTS on_like_created ON likes;
CREATE TRIGGER on_like_created
    AFTER INSERT ON likes
    FOR EACH ROW EXECUTE FUNCTION handle_new_like();
