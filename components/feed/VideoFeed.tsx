'use client'
import { useEffect, useLayoutEffect, useState, useRef, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import VideoItem from './VideoItem'
import { Video } from '@/types'
import { useVideoStore } from '@/lib/store/useVideoStore'
import { useAuth } from '@/components/AuthProvider'
import { Compass } from 'lucide-react'
import { getOptimizedVideoUrl } from '@/lib/utils/video-utils'

const BATCH_SIZE = 12

interface Props {
  initialVideos: Video[]
}

export default function VideoFeed({ initialVideos }: Props) {
  const { feedFilter } = useVideoStore()
  const { user } = useAuth()
  const supabase = createClient()

  const [videos, setVideos] = useState<Video[]>(initialVideos)
  const [cursor, setCursor] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [hasMore, setHasMore] = useState(true)
  const [followingMap, setFollowingMap] = useState<Record<string, boolean>>({})
  const scrollRef = useRef<HTMLDivElement>(null)

  // Sentinel div at the bottom — triggers infinite scroll via IntersectionObserver
  const sentinelRef = useRef<HTMLDivElement>(null)

  // Disable browser scroll restoration — it fires before React hydration and overrides our reset
  // Setting 'manual' means we own the scroll position entirely
  if (typeof window !== 'undefined') window.history.scrollRestoration = 'manual'

  // Force scroll to top before paint — prevents browser restoring old snap position on refresh
  useLayoutEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = 0
  }, [])

  const loadFollowStatuses = useCallback(async (creatorIds: string[]) => {
    if (!user || creatorIds.length === 0) return
    const uniqueIds = [...new Set(creatorIds)].filter(id => id !== user.id)
    if (uniqueIds.length === 0) return

    const { data } = await supabase
      .from('followers')
      .select('following_id')
      .eq('follower_id', user.id)
      .in('following_id', uniqueIds)

    if (data) {
      const allEntries: Record<string, boolean> = {}
      uniqueIds.forEach(id => { allEntries[id] = false })
      data.forEach(f => { allEntries[f.following_id] = true })
      setFollowingMap(prev => ({ ...prev, ...allEntries }))
    }
  }, [user, supabase])

  const loadFeed = useCallback(async (cursorVal: string | null, isReset: boolean) => {
    if (loading) return
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (cursorVal) params.set('cursor', cursorVal)
      params.set('filter', feedFilter)

      const res = await fetch(`/api/feed?${params.toString()}`)
      if (!res.ok) throw new Error(`Feed API returned ${res.status}`)

      const { posts, nextCursor } = await res.json() as { posts: Video[]; nextCursor: string | null }

      setHasMore(posts.length === BATCH_SIZE)
      setCursor(nextCursor)
      setVideos(prev => {
        if (isReset) return posts
        const deduped = posts.filter((v: Video) => !prev.some(p => p.id === v.id))
        return [...prev, ...deduped]
      })

      const creatorIds = posts.map((v: Video) => v.users?.id).filter(Boolean) as string[]
      loadFollowStatuses(creatorIds)
    } catch (err) {
      console.error('[VideoFeed] loadFeed error:', err)
    } finally {
      setLoading(false)
    }
  }, [feedFilter, loading, loadFollowStatuses])

  // Reset feed when filter changes
  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = 0
    setVideos([])
    setCursor(null)
    setHasMore(true)
    setFollowingMap({})
    setTimeout(() => loadFeed(null, true), 0)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [feedFilter])

  // Infinite scroll via IntersectionObserver on sentinel
  useEffect(() => {
    const sentinel = sentinelRef.current
    if (!sentinel) return

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && hasMore && !loading) {
          loadFeed(cursor, false)
        }
      },
      { root: scrollRef.current, threshold: 0.1 }
    )

    observer.observe(sentinel)
    return () => observer.disconnect()
  }, [cursor, hasMore, loading, loadFeed])

  const { activeVideoId } = useVideoStore()
  const currentIndex = activeVideoId ? videos.findIndex(v => v.id === activeVideoId) : 0
  const nextVideo = videos[currentIndex + 1]
  const nextNextVideo = videos[currentIndex + 2]

  const showEmptyFollowing = feedFilter === 'following' && !loading && videos.length === 0

  return (
    <div
      ref={scrollRef}
      className="h-[100dvh] w-full overflow-y-scroll snap-y snap-mandatory no-scrollbar relative"
    >
      {videos.map((video, index) => (
        <div key={video.id} className="snap-start h-[100dvh] w-full flex-shrink-0">
          <VideoItem
            video={video}
            index={index}
            initialFollowing={followingMap[video.users?.id] ?? false}
          />
        </div>
      ))}

      {/* Sentinel — triggers next page load when scrolled into view */}
      <div ref={sentinelRef} className="h-1 w-full" />

      {/* Skeleton placeholder */}
      {loading && videos.length === 0 && (
        <div className="h-[100dvh] w-full relative bg-gray-900 animate-pulse overflow-hidden snap-start">
          <div className="absolute bottom-20 right-4 flex flex-col gap-5 items-center z-20">
            <div className="w-12 h-12 rounded-full bg-gray-700" />
            <div className="w-10 h-10 rounded-full bg-gray-700" />
            <div className="w-10 h-10 rounded-full bg-gray-700" />
            <div className="w-10 h-10 rounded-full bg-gray-700" />
            <div className="w-12 h-12 rounded-full bg-gray-700 mt-2" />
          </div>
          <div className="absolute bottom-[80px] left-4 right-20 z-20 flex flex-col gap-3">
            <div className="w-28 h-4 bg-gray-700 rounded" />
            <div className="w-48 h-3 bg-gray-700 rounded" />
            <div className="w-36 h-3 bg-gray-700 rounded" />
            <div className="w-44 h-6 bg-gray-700 rounded-full mt-2" />
          </div>
          <div className="absolute bottom-0 left-0 right-0 h-1/2 bg-gradient-to-t from-black/60 to-transparent pointer-events-none" />
        </div>
      )}

      {/* Empty — Following tab */}
      {showEmptyFollowing && (
        <div className="h-[100dvh] w-full flex flex-col items-center justify-center gap-4 px-8 text-center snap-start">
          <Compass size={48} className="text-white/20" />
          <h2 className="text-xl font-bold text-white">No videos yet</h2>
          <p className="text-white/50 text-sm leading-relaxed">
            Follow some creators to see their videos here. Tap the{' '}
            <span className="text-brand-accent font-semibold">+ button</span> on any reel to follow.
          </p>
          <button
            onClick={() => useVideoStore.getState().setFeedFilter('forYou')}
            className="mt-2 px-6 py-2.5 bg-white text-black rounded-full font-bold text-sm hover:opacity-90 transition-opacity"
          >
            Explore For You
          </button>
        </div>
      )}

      {/* Hidden pre-buffer mounts (DOM-isolated) */}
      {nextVideo && (
        <video
          src={getOptimizedVideoUrl(nextVideo.video_url)}
          preload="auto"
          muted
          playsInline
          disablePictureInPicture
          style={{ display: 'none' }}
        />
      )}
      {nextNextVideo && (
        <video
          src={getOptimizedVideoUrl(nextNextVideo.video_url)}
          preload="metadata"
          muted
          playsInline
          disablePictureInPicture
          style={{ display: 'none' }}
        />
      )}
    </div>
  )
}