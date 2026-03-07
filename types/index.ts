export interface Profile {
  id: string
  username: string
  full_name?: string | null
  avatar_url: string | null
  bio: string | null
}

export interface Audio {
  id: string
  title: string
  artist: string
  audio_url: string
  used_count: number
  created_at: string
}

export interface Video {
  id: string
  user_id: string
  media_type: 'video' | 'photo'
  video_url: string
  thumbnail_url?: string | null
  audio_id?: string | null
  caption: string
  likes_count: number
  comments_count: number
  view_count: number
  deleted_at?: string | null
  users: Profile // Joined from Supabase
  audio?: Audio | null // Optional join
}

export interface Comment {
  id: string
  video_id: string
  user_id: string
  parent_id?: string | null
  content: string
  likes_count: number
  reply_count: number
  created_at: string
  deleted_at?: string | null
  users: Profile
}

export interface Like {
  id: string
  video_id: string
  user_id: string
  created_at: string
}

export interface Follower {
  follower_id: string
  following_id: string
  created_at: string
}

export interface Notification {
  id: string
  user_id: string
  actor_id?: string | null
  video_id?: string | null
  type: 'like' | 'follow' | 'trending' | string
  message: string | null
  is_read: boolean
  created_at: string
}