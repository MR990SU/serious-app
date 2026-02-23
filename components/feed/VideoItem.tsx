'use client'
import { useRef, useEffect, useState } from 'react'
import { useInView } from 'react-intersection-observer'
import { Video } from '@/types'
import { useVideoStore } from '@/lib/store/useVideoStore'
import ActionButtons from './ActionButtons'
import Link from 'next/link'
import { getOptimizedVideoUrl, getOptimizedPosterUrl } from '@/lib/utils/video-utils'
import { Music, Volume2, VolumeX } from 'lucide-react'
import { incrementViewCount } from '@/app/actions'

interface Props {
  video: Video
  index: number
  loadMore?: () => void
}

export default function VideoItem({ video, index, loadMore }: Props) {
  const { setActiveVideo } = useVideoStore()
  const videoRef = useRef<HTMLVideoElement>(null)
  const [isExpanded, setIsExpanded] = useState(false)
  const [isMuted, setIsMuted] = useState(false) // Try unmuted by default
  const viewLogged = useRef(false) // Check to avoid spamming the action

  // Observer: Playback tracking
  // Using a 40% threshold prevents strict mathematical misses on desktop viewport sizes
  // initialInView ensures the first video attempts to play immediately before the observer formally fires
  const { ref: playRef, inView: isPlaying } = useInView({
    threshold: 0.4,
    initialInView: index === 0
  })

  useEffect(() => {
    if (!videoRef.current) return

    if (isPlaying) {
      setActiveVideo(video.id, video.likes_count, video.comments_count || 0)
      if (!viewLogged.current) {
        incrementViewCount(video.id)
        viewLogged.current = true
      }
      // First attempt to play it with user's preferred mute state
      const playPromise = videoRef.current.play()

      if (playPromise !== undefined) {
        playPromise.catch(error => {
          // If browser strictly blocks unmuted autoplay, gently fallback to muted autoplay
          if (error.name === 'NotAllowedError') {
            console.log("Unmuted autoplay blocked by browser. Falling back to muted playback.")
            setIsMuted(true) // Update UI
            if (videoRef.current) {
              videoRef.current.muted = true
              videoRef.current.play().catch(e => console.error("Fallback playback failed", e))
            }
          }
        })
      }
      if (loadMore) loadMore()
    } else {
      videoRef.current?.pause()
      if (videoRef.current) videoRef.current.currentTime = 0
    }
  }, [isPlaying, loadMore])

  const optimizedVideoUrl = getOptimizedVideoUrl(video.video_url)
  const optimizedPosterUrl = getOptimizedPosterUrl(video.video_url)

  const toggleMute = (e: React.MouseEvent) => {
    e.stopPropagation()
    setIsMuted(!isMuted)
  }

  return (
    <div className="h-full w-full snap-start relative bg-black md:rounded-3xl md:overflow-hidden md:my-4 md:h-[calc(100vh-2rem)] md:border md:border-white/5 transition-all duration-300 shadow-2xl">
      <div ref={playRef} className="h-full w-full relative">

        {/* Background blur for edge filling on desktop */}
        <div
          className="absolute inset-0 bg-cover bg-center blur-2xl opacity-30 pointer-events-none md:block hidden scale-110"
          style={{ backgroundImage: `url(${optimizedPosterUrl})` }}
        />

        <video
          ref={videoRef}
          src={optimizedVideoUrl}
          poster={optimizedPosterUrl}
          className="h-full w-full object-cover relative z-10"
          loop
          playsInline
          muted={isMuted}
          preload="metadata"
          onClick={toggleMute}
          onContextMenu={(e) => e.preventDefault()}
        />

        {/* Mute Indicator Toggle */}
        <button
          onClick={toggleMute}
          className="absolute top-8 right-4 z-30 p-2 bg-black/40 backdrop-blur-md rounded-full text-white/80 hover:text-white transition-colors"
        >
          {isMuted ? <VolumeX size={20} /> : <Volume2 size={20} />}
        </button>

        {/* Fade Overlay at bottom for better text readability */}
        <div className="absolute bottom-0 left-0 right-0 h-1/2 bg-gradient-to-t from-black/80 via-black/40 to-transparent z-10 pointer-events-none" />

        {/* Overlay: Caption & User */}
        <div className="absolute bottom-[80px] md:bottom-8 left-4 right-20 z-20">
          <Link href={`/profile/${video.users.id}`} className="font-bold text-lg hover:underline flex items-center gap-2 mb-2">
            @{video.users.id.substring(0, 10)}
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

          {/* Scrolling Music Track Info / Caption */}
          <div className="flex items-center gap-2 mt-4 text-sm font-semibold text-white/80 overflow-hidden w-64 rounded-full px-3 py-1 glass max-w-full">
            <Music size={16} className="shrink-0 text-brand-secondary animate-pulse" />
            <div className="whitespace-nowrap overflow-hidden relative w-full">
              <p className="animate-[scroll_10s_linear_infinite] inline-block">
                {video.caption ? `${video.caption} • ` : `Original Sound - @${video.users.id.substring(0, 10)} • `}
              </p>
            </div>
          </div>
        </div>

        <ActionButtons video={video} />
      </div>
    </div>
  )
}