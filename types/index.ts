export interface Profile {
  id: string
  username: string
  avatar_url: string | null
  bio: string | null
}

export interface Video {
  id: string
  user_id: string
  video_url: string
  caption: string
  likes_count: number
  users: Profile // Joined from Supabase
}

export interface Comment {
  id: string
  video_id: string
  user_id: string
  content: string
  created_at: string
  users: Profile
}