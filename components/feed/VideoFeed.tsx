'use client'
import { useEffect, useState, useRef, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import VideoItem from './VideoItem'
import { Video } from '@/types'
import { useVideoStore } from '@/lib/store/useVideoStore'
import { useAuth } from '@/components/AuthProvider'
import { Compass } from 'lucide-react'
import { getOptimizedVideoUrl } from '@/lib/utils/video-utils'
import { useVirtualizer } from '@tanstack/react-virtual'

const BATCH_SIZE = 12

interface Props {
  initialVideos: Video[]
}

export default function VideoFeed({ initialVideos }: Props) {
  const { feedFilter, activeVideoId } = useVideoStore()
  const { user } = useAuth()
  const supabase = createClient()

  const [videos, setVideos] = useState<Video[]>(initialVideos)
  const [cursor, setCursor] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [hasMore, setHasMore] = useState(true)
  const [followingMap, setFollowingMap] = useState<Record<string, boolean>>({})
  const scrollRef = useRef<HTMLDivElement>(null)
  const [viewportHeight, setViewportHeight] = useState(0)

  // Initialize viewport height for server side rendering safety
  useEffect(() => {
    setViewportHeight(window.innerHeight)

    const handleResize = () => setViewportHeight(window.innerHeight)
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  const rowVirtualizer = useVirtualizer({
    count: videos.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => viewportHeight || 800, // Fallback until mounted
    overscan: 3,
  })

  /**
   * Batch-fetch follow statuses for a list of creator IDs and merge into followingMap.
   */
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
      const newEntries = Object.fromEntries(data.map(f => [f.following_id, true]))
      const allEntries: Record<string, boolean> = {}
      uniqueIds.forEach(id => { allEntries[id] = false })
      Object.assign(allEntries, newEntries)

      setFollowingMap(prev => ({ ...prev, ...allEntries }))
    }
  }, [user, supabase])

  // ── Load feed via /api/feed with cursor pagination ─────────
  const loadFeed = useCallback(async (cursorVal: string | null, isReset: boolean) => {
    if (loading) return
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (cursorVal) params.set('cursor', cursorVal)
      params.set('filter', feedFilter)

      const res = await fetch(`/api/feed?${params.toString()}`)
      if (!res.ok) throw new Error(`Feed API returned ${res.status}`)

      const { posts, nextCursor } = await res.json() as {
        posts: Video[]
        nextCursor: string | null
      }

      setHasMore(posts.length === BATCH_SIZE)
      setCursor(nextCursor)

      setVideos(prev => {
        if (isReset) return posts
        const deduped = posts.filter((v: Video) => !prev.some(p => p.id === v.id))
        return [...prev, ...deduped]
      })

      // Batch-fetch follow statuses for all creators in this page
      const creatorIds = posts.map((v: Video) => v.users?.id).filter(Boolean) as string[]
      loadFollowStatuses(creatorIds)
    } catch (err) {
      console.error('[VideoFeed] loadFeed error:', err)
    } finally {
      setLoading(false)
    }
  }, [feedFilter, loading, loadFollowStatuses])

  // ── Reset feed when filter changes ────────────────────────
  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = 0

    setVideos([])
    setCursor(null)
    setHasMore(true)
    setFollowingMap({})
    // Load first page after state resets on next tick
    setTimeout(() => loadFeed(null, true), 0)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [feedFilter])

  const handleLoadMore = useCallback(() => {
    if (!loading && hasMore && cursor) loadFeed(cursor, false)
  }, [loading, hasMore, cursor, loadFeed])

  // Track virtualizer to trigger infinite scroll
  const virtualItems = rowVirtualizer.getVirtualItems()
  const lastIndex = virtualItems[virtualItems.length - 1]?.index

  useEffect(() => {
    if (lastIndex !== undefined && lastIndex >= videos.length - 3) {
      handleLoadMore()
    }
  }, [lastIndex, videos.length, handleLoadMore])

  // Prevent scroll jumping when new batch appends
  useEffect(() => {
    rowVirtualizer.measure()
  }, [videos.length, rowVirtualizer])

  // ── Preload next videos dynamically ───────────────
  const currentIndex = activeVideoId
    ? videos.findIndex(v => v.id === activeVideoId)
    : 0

  const nextVideo = videos[currentIndex + 1]
  const nextNextVideo = videos[currentIndex + 2]

  // ── Empty state for Following tab ─────────────────────────
  const showEmptyFollowing =
    feedFilter === 'following' && !loading && videos.length === 0

  return (
    <div
      ref={scrollRef}
      className="h-[100dvh] w-full overflow-y-scroll snap-y snap-mandatory no-scrollbar relative"
    >
      <div
        className="relative w-full"
        style={{
          height: `${rowVirtualizer.getTotalSize()}px`,
        }}
      >
        {rowVirtualizer.getVirtualItems().map((virtualItem) => {
          const video = videos[virtualItem.index]
          if (!video) return null

          return (
            <div
              key={virtualItem.key}
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                height: `${virtualItem.size}px`,
                transform: `translateY(${virtualItem.start}px)`,
              }}
            >
              <VideoItem
                video={video}
                index={virtualItem.index}
                initialFollowing={followingMap[video.users?.id] ?? false}
              // Disconnect local loadMore from VideoItem, we now handle it globally
              />
            </div>
          )
        })}
      </div>

      {/* Skeleton reel placeholder */}
      {loading && videos.length === 0 && (
        <div className="h-[100dvh] w-full relative bg-gray-900 animate-pulse overflow-hidden">
          {/* Fake action buttons */}
          <div className="absolute bottom-20 right-4 flex flex-col gap-5 items-center z-20">
            <div className="w-12 h-12 rounded-full bg-gray-700" />
            <div className="w-10 h-10 rounded-full bg-gray-700" />
            <div className="w-10 h-10 rounded-full bg-gray-700" />
            <div className="w-10 h-10 rounded-full bg-gray-700" />
            <div className="w-12 h-12 rounded-full bg-gray-700 mt-2" />
          </div>
          {/* Fake caption area */}
          <div className="absolute bottom-[80px] left-4 right-20 z-20 flex flex-col gap-3">
            <div className="w-28 h-4 bg-gray-700 rounded" />
            <div className="w-48 h-3 bg-gray-700 rounded" />
            <div className="w-36 h-3 bg-gray-700 rounded" />
            <div className="w-44 h-6 bg-gray-700 rounded-full mt-2" />
          </div>
          {/* Gradient overlay */}
          <div className="absolute bottom-0 left-0 right-0 h-1/2 bg-gradient-to-t from-black/60 to-transparent pointer-events-none" />
        </div>
      )}

      {/* Empty — Following tab */}
      {showEmptyFollowing && (
        <div className="h-[100dvh] w-full flex flex-col items-center justify-center gap-4 px-8 text-center">
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