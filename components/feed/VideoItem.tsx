'use client'
import { useRef, useEffect, useState, memo } from 'react'
import { useDoubleTap } from 'use-double-tap'
import { useInView } from 'react-intersection-observer'
import { motion, AnimatePresence } from 'framer-motion'
import { Video } from '@/types'
import { useVideoStore } from '@/lib/store/useVideoStore'
import ActionButtons from './ActionButtons'
import Link from 'next/link'
import Image from 'next/image'
import { getOptimizedVideoUrl, getOptimizedPosterUrl } from '@/lib/utils/video-utils'
import { Music, Volume2, VolumeX } from 'lucide-react'
import { incrementViewCount, toggleLike } from '@/app/actions/video-actions'
import { HeartAnimation } from '@/components/ui/HeartAnimation'
import { createClient } from '@/lib/supabase/client'

interface Props {
  video: Video
  index: number
  initialFollowing?: boolean
}

export default memo(function VideoItem({ video, index, initialFollowing = false }: Props) {
  const { setActiveVideo, isMuted, setMuted } = useVideoStore()

  const videoRef = useRef<HTMLVideoElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const [isExpanded, setIsExpanded] = useState(false)

  // Like state
  const [heartTrigger, setHeartTrigger] = useState(0)
  const [heartPos, setHeartPos] = useState({ x: 0, y: 0 })
  const [isLiked, setIsLiked] = useState(false)
  const [videoReady, setVideoReady] = useState(false)

  // Sound indicator
  const [showSoundIndicator, setShowSoundIndicator] = useState(false)
  const soundTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const viewLogged = useRef(false)
  const supabase = createClient()

  // Primary playback observer
  const { ref: viewRef, inView: isPlaying } = useInView({
    threshold: 0.8,
    initialInView: index === 0,
    triggerOnce: false
  })

  // Secondary preload observer (~1 viewport ahead)
  const { ref: loadRef, inView: isNearInView } = useInView({
    rootMargin: '1200px 0px',
    threshold: 0,
    triggerOnce: false
  })

  // Merge all three refs onto the same inner div
  const setRefs = (el: HTMLDivElement | null) => {
    viewRef(el)
    loadRef(el)
      ; (containerRef as React.MutableRefObject<HTMLDivElement | null>).current = el
  }

  // Determine active preload strategy
  const shouldMountVideo = isPlaying || isNearInView || index === 0

  const preloadStrategy = isPlaying || index === 0
    ? 'auto'
    : isNearInView
      ? 'metadata'
      : 'none'

  // Hydrate like state
  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) {
        supabase
          .from('likes')
          .select('id')
          .eq('video_id', video.id)
          .eq('user_id', user.id)
          .maybeSingle()
          .then(({ data }) => { if (data) setIsLiked(true) })
      }
    })
  }, [video.id, supabase])

  const handleDoubleTap = async (e: React.MouseEvent) => {
    const rect = e.currentTarget.getBoundingClientRect()
    const x = e.clientX - rect.left
    const y = e.clientY - rect.top
    setHeartPos({ x, y })
    setHeartTrigger(Date.now())
    if (!isLiked) {
      setIsLiked(true)
      if (video.id === useVideoStore.getState().activeVideoId) {
        useVideoStore.getState().incrementLikeCount()
      }
      const result = await toggleLike(video.id)
      if (!result || !result.success) {
        setIsLiked(false)
        if (video.id === useVideoStore.getState().activeVideoId) {
          useVideoStore.getState().decrementLikeCount()
        }
      }
    }
  }

  // Toggle mute + show 800ms sound overlay
  const toggleMute = () => {
    setMuted(!isMuted)
    if (soundTimerRef.current) clearTimeout(soundTimerRef.current)
    setShowSoundIndicator(true)
    soundTimerRef.current = setTimeout(() => setShowSoundIndicator(false), 800)
  }

  // Double tap = like | Single tap = play/pause toggle
  const tapBind = useDoubleTap(
    (e) => { handleDoubleTap(e) },   // double tap
    300,
    {
      onSingleTap: () => {
        if (!videoRef.current) return
        if (videoRef.current.paused) {
          videoRef.current.play()
        } else {
          videoRef.current.pause()
        }
      }
    }
  )

  // Playback control
  useEffect(() => {
    if (video.media_type === 'photo') {
      if (isPlaying) {
        setActiveVideo(video.id, video.likes_count, video.comments_count || 0)
        if (!viewLogged.current) {
          incrementViewCount(video.id)
          viewLogged.current = true
        }
      }
      return
    }

    if (!videoRef.current) return

    if (isPlaying) {
      setActiveVideo(video.id, video.likes_count, video.comments_count || 0)
      if (!viewLogged.current) {
        incrementViewCount(video.id)
        viewLogged.current = true
      }

      // Preload the next video in the feed immediately to reduce buffering delays
      const nextContainer = containerRef.current?.parentElement?.nextElementSibling as HTMLElement | null
      const nextVideo = nextContainer?.querySelector('video')
      if (nextVideo) {
        nextVideo.preload = 'auto'
      }

      const playPromise = videoRef.current.play()
      if (playPromise !== undefined) {
        playPromise.catch((error: { name: string }) => {
          if (error.name === 'NotAllowedError') {
            setMuted(true)
            if (videoRef.current) {
              videoRef.current.muted = true
              videoRef.current.play().catch((e: unknown) => console.error('Fallback playback failed', e))
            }
          }
        })
      }
    } else {
      videoRef.current?.pause()
      if (videoRef.current) videoRef.current.currentTime = 0
    }
  }, [isPlaying, video.media_type, video.id, video.likes_count, video.comments_count, index, setActiveVideo, setMuted])

  const optimizedVideoUrl = getOptimizedVideoUrl(video.video_url)
  const optimizedPosterUrl = getOptimizedPosterUrl(video.video_url)

  // Auto-advance to next reel on video end
  const handleNextVideo = () => {
    if (!useVideoStore.getState().autoPlayEnabled) return
    const next = containerRef.current?.parentElement?.nextElementSibling as HTMLElement | null
    if (next) next.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  // Unmount cleanup
  useEffect(() => {
    const vEl = videoRef.current
    return () => {
      if (vEl) {
        vEl.pause()
        vEl.src = ''
        vEl.load()
      }
    }
  }, [])

  return (
    <div className="h-[100dvh] max-h-[100dvh] w-full snap-start relative bg-black overflow-hidden md:rounded-3xl md:my-4 md:h-[calc(100dvh-2rem)] md:max-h-[calc(100dvh-2rem)] md:border md:border-white/5 transition-all duration-300 shadow-2xl flex-shrink-0">
      <div ref={setRefs} className="h-full w-full relative">

        {/* Background blur */}
        <div
          className="absolute inset-0 bg-cover bg-center blur-2xl opacity-30 pointer-events-none md:block hidden scale-110"
          style={{ backgroundImage: `url(${optimizedPosterUrl})` }}
        />

        {/* Poster overlay — fades out once video data is buffered */}
        <div
          className={`absolute inset-0 z-[11] bg-cover bg-center transition-opacity duration-500 pointer-events-none ${videoReady ? 'opacity-0' : 'opacity-100'}`}
          style={{ backgroundImage: `url(${optimizedPosterUrl})` }}
        />

        {video.media_type === 'photo' ? (
          <Image
            src={video.video_url}
            alt={video.caption}
            fill
            className="object-cover relative z-10"
            unoptimized={video.video_url.includes('supabase.co')}
          />
        ) : shouldMountVideo ? (
          <video
            ref={videoRef}
            src={optimizedVideoUrl}
            poster={optimizedPosterUrl}
            className="h-full w-full object-cover relative z-10"
            loop
            playsInline
            muted={isMuted}
            preload={preloadStrategy}
            controlsList="nodownload"
            onLoadedData={() => setVideoReady(true)}
            onClick={tapBind.onClick}
            onEnded={handleNextVideo}
            onContextMenu={e => e.preventDefault()}
          />
        ) : (
          <div
            className="h-full w-full relative z-10 bg-cover bg-center"
            style={{ backgroundImage: `url(${optimizedPosterUrl})` }}
          />
        )}

        {/* Heart Overlay */}
        <HeartAnimation triggerTimestamp={heartTrigger} x={heartPos.x} y={heartPos.y} />

        {/* Sound indicator overlay — Instagram style */}
        <div className="pointer-events-none absolute inset-0 z-30 flex items-center justify-center">
          <AnimatePresence mode="wait">
            {showSoundIndicator && (
              <motion.div
                key={isMuted ? 'muted' : 'unmuted'}
                initial={{ scale: 0.5, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.8, opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="flex items-center justify-center"
              >
                {isMuted
                  ? <VolumeX size={64} className="text-white drop-shadow-lg" />
                  : <Volume2 size={64} className="text-white drop-shadow-lg" />
                }
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Bottom gradient overlay */}
        <div className="absolute bottom-0 left-0 right-0 h-1/2 bg-gradient-to-t from-black/80 via-black/40 to-transparent z-10 pointer-events-none" />

        {/* Caption & User */}
        <div className="absolute bottom-[80px] md:bottom-8 left-4 right-20 z-20">
          <Link href={`/profile/${video.users.id}`} prefetch className="font-bold text-lg hover:underline flex items-center gap-2 mb-2">
            @{video.users.username}
          </Link>
          <div className="text-sm">
            <p className={`${isExpanded ? '' : 'line-clamp-2'} transition-all`}>
              {video.caption?.split(/(#[\w]+|@[\w]+)/g).map((part, i) => {
                if (part.startsWith('#')) {
                  const tag = part.slice(1)
                  return <Link key={i} href={`/discover?q=${tag}`} onClick={(e) => e.stopPropagation()} className="hover:underline">{part}</Link>
                }
                if (part.startsWith('@')) {
                  const username = part.slice(1)
                  return <Link key={i} href={`/profile/${username}`} onClick={(e) => e.stopPropagation()} className="hover:underline">{part}</Link>
                }
                return <span key={i}>{part}</span>
              })}
            </p>
            {video.caption && video.caption.length > 50 && (
              <button onClick={() => setIsExpanded(!isExpanded)} className="font-bold text-white/70 hover:text-white mt-1">
                {isExpanded ? 'less' : 'more'}
              </button>
            )}
          </div>

          <div className="flex items-center gap-3 mt-4 w-full">
            {/* Scrolling Music Track */}
            <Link
              href={video.audio_id ? `/audio/${video.audio_id}` : '#'}
              className="flex items-center gap-2 text-sm font-semibold text-white/80 overflow-hidden rounded-full px-3 py-1.5 glass flex-1 max-w-[220px]"
            >
              <Music size={14} className="shrink-0 text-brand-secondary" />
              <div className="whitespace-nowrap overflow-hidden relative w-full">
                <p className="animate-[scroll_10s_linear_infinite] inline-block">
                  {video.audio ? `${video.audio.title} - ${video.audio.artist} • ` : `Original Sound - @${video.users.username} • `}
                </p>
              </div>
            </Link>
          </div>
        </div>

        <ActionButtons video={video} initialFollowing={initialFollowing} />
      </div>
    </div>
  )
})