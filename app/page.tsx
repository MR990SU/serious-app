import VideoFeed from '@/components/feed/VideoFeed'
import { createClient } from '@/lib/supabase/server'

// Cache this page for 60 seconds (ISR)
export const revalidate = 60

export default async function Home() {
  const supabase = await createClient()

  // Initial server-side fetch to save Supabase egress on frequent page loads
  const { data: initialVideos } = await supabase
    .from('videos')
    .select('id, user_id, video_url, thumbnail_url, caption, created_at, likes_count, views_count, users(id, username, avatar_url)')
    .order('created_at', { ascending: false })
    .range(0, 2)

  // Format array if needed
  const formattedVideos = initialVideos?.map((v: any) => ({
    ...v,
    users: Array.isArray(v.users) ? v.users[0] : v.users
  })) || []

  return (
    <main className="h-screen w-full bg-black">
      <VideoFeed initialVideos={formattedVideos as any} />
    </main>
  )
}