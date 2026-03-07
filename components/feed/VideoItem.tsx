'use client'
import { useRef, useEffect, useState, memo } from 'react'
import { useInView } from 'react-intersection-observer'
import { Video } from '@/types'
import { useVideoStore } from '@/lib/store/useVideoStore'
import ActionButtons from './ActionButtons'
import Link from 'next/link'
import Image from 'next/image'
import { getOptimizedVideoUrl, getOptimizedPosterUrl } from '@/lib/utils/video-utils'
import { Music, Volume2, VolumeX, Disc3 } from 'lucide-react'
import { incrementViewCount, toggleLike } from '@/app/actions/video-actions'
import { HeartAnimation } from '@/components/ui/HeartAnimation'
import { createClient } from '@/lib/supabase/client'

interface Props {
  video: Video
  index: number
  initialFollowing?: boolean
}

export default memo(function VideoItem({ video, index, initialFollowing = false }: Props) {
  const { setActiveVideo } = useVideoStore()
  const videoRef = useRef<HTMLVideoElement>(null)
  const [isExpanded, setIsExpanded] = useState(false)
  const [isMuted, setIsMuted] = useState(index === 0)  // first video starts muted for autoplay compliance

  // Like states
  const [heartTrigger, setHeartTrigger] = useState(0)
  const lastTapRef = useRef(0)
  const [isLiked, setIsLiked] = useState(false)
  const [videoReady, setVideoReady] = useState(false)
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

  // Set merged refs
  const setRefs = (el: HTMLDivElement | null) => {
    viewRef(el)
    loadRef(el)
  }

  // Determine active preload strategy
  const shouldMountVideo = isPlaying || isNearInView || index === 0

  const preloadStrategy = isPlaying || index === 0
    ? 'auto'
    : isNearInView
      ? 'metadata'
      : 'none'

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

  const handleDoubleTap = async () => {
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

  const handleTapSequence = (e: React.MouseEvent | React.TouchEvent) => {
    e.stopPropagation()
    const now = Date.now()
    if (now - lastTapRef.current < 300) {
      handleDoubleTap()
    } else {
      setTimeout(() => {
        const latest = Date.now()
        if (latest - lastTapRef.current >= 300) {
          toggleMute()
        }
      }, 300)
    }
    lastTapRef.current = now
  }

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
      const playPromise = videoRef.current.play()
      if (playPromise !== undefined) {
        playPromise.catch(error => {
          if (error.name === 'NotAllowedError') {
            setIsMuted(true)
            if (videoRef.current) {
              videoRef.current.muted = true
              videoRef.current.play().catch(e => console.error('Fallback playback failed', e))
            }
          }
        })
      }
    } else {
      videoRef.current?.pause()
      if (videoRef.current) videoRef.current.currentTime = 0
    }
  }, [isPlaying, video.media_type, video.id, video.likes_count, video.comments_count, index])

  const optimizedVideoUrl = getOptimizedVideoUrl(video.video_url)
  const optimizedPosterUrl = getOptimizedPosterUrl(video.video_url)

  const toggleMute = () => {
    setIsMuted(prev => !prev)
  }

  const handleNextVideo = () => {
    if (useVideoStore.getState().autoPlayEnabled && videoRef.current) {
      const parent = videoRef.current.closest('.snap-start')
      const nextSibling = parent?.nextElementSibling as HTMLElement
      if (nextSibling) {
        nextSibling.scrollIntoView({ behavior: 'smooth', block: 'start' })
      }
    }
  }

  // Unmount cleanup logic (critical for virtualization)
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
    // Each item must occupy exactly one viewport — overflow-hidden prevents bleed on partial scroll
    <div className="h-[100dvh] max-h-[100dvh] w-full snap-start relative bg-black overflow-hidden md:rounded-3xl md:my-4 md:h-[calc(100dvh-2rem)] md:max-h-[calc(100dvh-2rem)] md:border md:border-white/5 transition-all duration-300 shadow-2xl flex-shrink-0">
      <div ref={setRefs} className="h-full w-full relative">

        {/* Background blur */}
        <div
          className="absolute inset-0 bg-cover bg-center blur-2xl opacity-30 pointer-events-none md:block hidden scale-110"
          style={{ backgroundImage: `url(${optimizedPosterUrl})` }}
        />

        {/* Poster overlay — fades out once video data is buffered */}
        <div
          className={`absolute inset-0 z-[11] bg-cover bg-center transition-opacity duration-500 pointer-events-none ${videoReady ? 'opacity-0' : 'opacity-100'
            }`}
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
          <>
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
              onClick={handleTapSequence}
              onEnded={handleNextVideo}
              onContextMenu={(e) => e.preventDefault()}
            />
            {/* Mute Toggle — moved below z-50 top nav to prevent overlap */}
            <button
              onClick={toggleMute}
              className="absolute top-16 right-4 z-20 p-2 bg-black/40 backdrop-blur-md rounded-full text-white/80 hover:text-white transition-colors"
            >
              {isMuted ? <VolumeX size={20} /> : <Volume2 size={20} />}
            </button>
          </>
        ) : (
          <div
            className="h-full w-full relative z-10 bg-cover bg-center"
            style={{ backgroundImage: `url(${optimizedPosterUrl})` }}
          />
        )}

        {/* Heart Overlay */}
        <HeartAnimation triggerTimestamp={heartTrigger} />

        {/* Bottom gradient overlay */}
        <div className="absolute bottom-0 left-0 right-0 h-1/2 bg-gradient-to-t from-black/80 via-black/40 to-transparent z-10 pointer-events-none" />

        {/* Caption & User — Fixed: now shows username instead of UUID substring */}
        <div className="absolute bottom-[80px] md:bottom-8 left-4 right-20 z-20">
          <Link href={`/profile/${video.users.id}`} prefetch className="font-bold text-lg hover:underline flex items-center gap-2 mb-2">
            @{video.users.username}
          </Link>
          <div className="text-sm">
            <p className={`${isExpanded ? '' : 'line-clamp-2'} transition-all`}>
              {video.caption}
            </p>
            {video.caption && video.caption.length > 50 && (
              <button onClick={() => setIsExpanded(!isExpanded)} className="font-bold text-white/70 hover:text-white mt-1">
                {isExpanded ? 'less' : 'more'}
              </button>
            )}
          </div>

          <div className="flex items-center gap-3 mt-4 w-full">
            {/* Rotating Audio Disk */}
            <Link
              href={video.audio_id ? `/audio/${video.audio_id}` : '#'}
              className={`shrink-0 w-10 h-10 rounded-full bg-gray-800 border-2 border-gray-600 flex items-center justify-center overflow-hidden z-30 transition-transform hover:scale-110 animate-spin [animation-duration:4s] ${!isPlaying && '[animation-play-state:paused]'}`}
            >
              <Disc3 size={20} className="text-white relative z-10" />
              <div className="absolute inset-0 bg-gradient-to-br from-gray-700 to-black opacity-50" />
            </Link>

            {/* Scrolling Music Track */}
            <Link
              href={video.audio_id ? `/audio/${video.audio_id}` : '#'}
              className="flex items-center gap-2 text-sm font-semibold text-white/80 overflow-hidden rounded-full px-3 py-1.5 glass flex-1 max-w-[200px]"
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
    </div >
  )
})