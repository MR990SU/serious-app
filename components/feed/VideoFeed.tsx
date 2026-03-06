'use client'
import { useEffect, useState, useRef, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import VideoItem from './VideoItem'
import { Video } from '@/types'
import { useVideoStore } from '@/lib/store/useVideoStore'
import { useAuth } from '@/components/AuthProvider'
import { Compass } from 'lucide-react'

const BATCH_SIZE = 10

interface Props {
  initialVideos: Video[]
}

export default function VideoFeed({ initialVideos }: Props) {
  const { feedFilter } = useVideoStore()
  // Use AuthProvider context — avoids an extra getUser() call in this component
  const { user } = useAuth()
  const supabase = createClient()

  const [videos, setVideos] = useState<Video[]>(initialVideos)
  const [page, setPage] = useState(0)
  const [loading, setLoading] = useState(false)
  const [hasMore, setHasMore] = useState(true)
  // Maps video.users.id → following boolean — loaded in one batch per page fetch
  const [followingMap, setFollowingMap] = useState<Record<string, boolean>>({})
  const scrollRef = useRef<HTMLDivElement>(null)

  // Normalize joined users field (Supabase sometimes returns array)
  const normalize = (data: any[]): Video[] =>
    data.map(v => ({ ...v, users: Array.isArray(v.users) ? v.users[0] : v.users })) as Video[]

  /**
   * Batch-fetch follow statuses for a list of creator IDs and merge into followingMap.
   * One query replaces N per-video queries in ActionButtons.
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
      // Fill non-followed IDs explicitly with false so ActionButtons skips the individual query
      const allEntries: Record<string, boolean> = {}
      uniqueIds.forEach(id => { allEntries[id] = false })
      Object.assign(allEntries, newEntries)

      setFollowingMap(prev => ({ ...prev, ...allEntries }))
    }
  }, [user, supabase])

  // ── For You feed ──────────────────────────────────────────────
  const fetchForYou = useCallback(async (pageNum: number): Promise<Video[]> => {
    const { data: trending, error: tErr } = await supabase
      .from('trending_videos')
      .select('*, users:profiles(id, username, avatar_url)')
      .range(pageNum * BATCH_SIZE, (pageNum + 1) * BATCH_SIZE - 1)

    if (!tErr && trending && trending.length > 0) {
      return normalize(trending.map((v: any) => ({ ...v, id: v.video_id })))
    }

    const { data, error } = await supabase
      .from('videos')
      .select('*, users:profiles(id, username, avatar_url)')
      .is('deleted_at', null)
      .order('created_at', { ascending: false })
      .range(pageNum * BATCH_SIZE, (pageNum + 1) * BATCH_SIZE - 1)

    if (error) console.error('[VideoFeed] forYou fetch error:', error.message)
    return normalize(data ?? [])
  }, [])

  // ── Following feed ────────────────────────────────────────────
  const fetchFollowing = useCallback(async (pageNum: number, userId: string): Promise<Video[]> => {
    const { data: followData, error: fErr } = await supabase
      .from('followers')
      .select('following_id')
      .eq('follower_id', userId)

    if (fErr || !followData || followData.length === 0) return []

    const followingIds = followData.map(f => f.following_id)

    const { data, error } = await supabase
      .from('videos')
      .select('*, users:profiles(id, username, avatar_url)')
      .in('user_id', followingIds)
      .is('deleted_at', null)
      .order('created_at', { ascending: false })
      .range(pageNum * BATCH_SIZE, (pageNum + 1) * BATCH_SIZE - 1)

    if (error) console.error('[VideoFeed] following fetch error:', error.message)
    return normalize(data ?? [])
  }, [])

  // ── Load a page of videos ─────────────────────────────────────
  const loadPage = useCallback(async (pageNum: number, userId: string | null) => {
    if (loading) return
    setLoading(true)
    try {
      let newVideos: Video[] = []
      if (feedFilter === 'forYou') {
        newVideos = await fetchForYou(pageNum)
      } else if (feedFilter === 'following' && userId) {
        newVideos = await fetchFollowing(pageNum, userId)
      }

      setHasMore(newVideos.length === BATCH_SIZE)
      setVideos(prev => {
        const deduped = newVideos.filter(v => !prev.some(p => p.id === v.id))
        return pageNum === 0 ? newVideos : [...prev, ...deduped]
      })
      setPage(pageNum + 1)

      // Batch-fetch follow statuses for all creators in this page
      const creatorIds = newVideos.map(v => v.users?.id).filter(Boolean) as string[]
      loadFollowStatuses(creatorIds)
    } finally {
      setLoading(false)
    }
  }, [feedFilter, loading, fetchForYou, fetchFollowing, loadFollowStatuses])

  // ── Reset feed when filter changes ────────────────────────────
  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = 0

    setVideos([])
    setPage(0)
    setHasMore(true)
    setFollowingMap({})
    // Load first page after state resets on next tick
    setTimeout(() => loadPage(0, user?.id ?? null), 0)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [feedFilter])

  const handleLoadMore = useCallback(() => {
    if (!loading && hasMore) loadPage(page, user?.id ?? null)
  }, [loading, hasMore, page, user?.id, loadPage])

  // ── Empty state for Following tab ─────────────────────────────
  const showEmptyFollowing =
    feedFilter === 'following' && !loading && videos.length === 0

  return (
    <div
      ref={scrollRef}
      className="h-[100dvh] w-full overflow-y-scroll snap-y snap-mandatory no-scrollbar"
    >
      {videos.map((video, index) => (
        <VideoItem
          key={video.id}
          video={video}
          index={index}
          initialFollowing={followingMap[video.users?.id] ?? false}
          loadMore={index === videos.length - 2 && hasMore ? handleLoadMore : undefined}
        />
      ))}

      {/* Loading skeleton */}
      {loading && videos.length === 0 && (
        <div className="h-[100dvh] w-full flex items-center justify-center">
          <div className="flex flex-col items-center gap-4 text-white/50">
            <div className="w-10 h-10 border-2 border-white/20 border-t-white/80 rounded-full animate-spin" />
            <span className="text-sm">Loading feed...</span>
          </div>
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
    </div>
  )
}