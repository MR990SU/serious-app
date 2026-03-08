import VideoFeed from '@/components/feed/VideoFeed'
import { createClient } from '@/lib/supabase/server'

// Cache this page for 60 seconds (ISR)
export const revalidate = 60

export default async function Home() {
  const supabase = await createClient()

  // Try trending view first for reels
  let initialVideos: any[] | null = null
  const { data: trendingVideos, error } = await supabase
    .from('trending_videos')
    .select('*, users:profiles(id, username, avatar_url)')
    .limit(4)

  initialVideos = trendingVideos

  if (error || !initialVideos || initialVideos.length === 0) {
    if (error && Object.keys(error).length > 0) {
      console.warn("Trending fetch warning:", (error as any).message || error)
    }
    // Fallback to standard fetch if trending is empty
    const { data: fallbackVideos, error: fallbackError } = await supabase
      .from('videos')
      .select('*, users:profiles(id, username, avatar_url)')
      .is('deleted_at', null)
      .order('created_at', { ascending: false })
      .range(0, 3)

    if (fallbackError && Object.keys(fallbackError).length > 0) {
      console.error("Fallback Error:", (fallbackError as any).message || fallbackError)
    }
    initialVideos = fallbackVideos
  }

  // Format array if needed
  const formattedVideos = initialVideos?.map((v: any) => ({
    ...v,
    id: v.video_id || v.id, // Support materialized view ID mapping
    users: Array.isArray(v.users) ? v.users[0] : v.users
  })) || []

  return (
    <main className="h-screen w-full bg-black">
      <VideoFeed initialVideos={formattedVideos as any} />
    </main>
  )
}