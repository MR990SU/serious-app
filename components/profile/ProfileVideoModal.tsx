'use client'

import { useRef, useEffect, useCallback, useState } from 'react'
import { X, ChevronLeft, ChevronRight, Volume2, VolumeX, Play } from 'lucide-react'
import { Video } from '@/types'
import { getOptimizedVideoUrl, getOptimizedPosterUrl } from '@/lib/utils/video-utils'

interface Props {
    video: Video
    videos: Video[]
    onClose: () => void
    onNavigate: (video: Video) => void
}

export function ProfileVideoModal({ video, videos, onClose, onNavigate }: Props) {
    const videoRef = useRef<HTMLVideoElement>(null)
    const [isMuted, setIsMuted] = useState(false)
    const [isPlaying, setIsPlaying] = useState(true)

    const currentIndex = videos.findIndex(v => v.id === video.id)
    const hasPrev = currentIndex > 0
    const hasNext = currentIndex < videos.length - 1

    // Auto-play on open & when navigating
    useEffect(() => {
        const el = videoRef.current
        if (!el) return
        el.currentTime = 0
        setIsPlaying(true)
        const playPromise = el.play()
        if (playPromise !== undefined) {
            playPromise.catch(err => {
                if (err.name === 'NotAllowedError') {
                    setIsMuted(true)
                    el.muted = true
                    el.play().catch(() => { })
                }
            })
        }
    }, [video.id])

    // Pause on close (cleanup)
    useEffect(() => {
        const el = videoRef.current
        return () => {
            if (el) {
                el.pause()
                el.currentTime = 0
            }
        }
    }, [])

    // Keyboard navigation
    useEffect(() => {
        const handleKey = (e: KeyboardEvent) => {
            if (e.key === 'Escape') onClose()
            if (e.key === 'ArrowLeft' && hasPrev) onNavigate(videos[currentIndex - 1])
            if (e.key === 'ArrowRight' && hasNext) onNavigate(videos[currentIndex + 1])
        }
        document.addEventListener('keydown', handleKey)
        return () => document.removeEventListener('keydown', handleKey)
    }, [onClose, hasPrev, hasNext, currentIndex, videos, onNavigate])

    // Lock body scroll
    useEffect(() => {
        document.body.style.overflow = 'hidden'
        return () => { document.body.style.overflow = '' }
    }, [])

    const toggleMute = (e: React.MouseEvent) => {
        e.stopPropagation()
        setIsMuted(prev => !prev)
    }

    const togglePlayPause = () => {
        const el = videoRef.current
        if (!el) return
        if (el.paused) {
            el.play()
            setIsPlaying(true)
        } else {
            el.pause()
            setIsPlaying(false)
        }
    }

    const optimizedVideoUrl = getOptimizedVideoUrl(video.video_url)
    const optimizedPosterUrl = getOptimizedPosterUrl(video.video_url)

    return (
        <div
            className="fixed inset-0 z-[300] flex items-center justify-center"
            role="dialog"
            aria-modal="true"
        >
            {/* Backdrop */}
            <div
                className="absolute inset-0 bg-black/90 backdrop-blur-md"
                onClick={onClose}
            />

            {/* Close button */}
            <button
                onClick={onClose}
                className="absolute top-4 right-4 z-10 p-2.5 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors backdrop-blur-sm"
                aria-label="Close modal"
            >
                <X size={22} />
            </button>

            {/* Prev button */}
            {hasPrev && (
                <button
                    onClick={() => onNavigate(videos[currentIndex - 1])}
                    className="absolute left-3 md:left-6 z-10 p-3 rounded-full bg-white/10 hover:bg-white/20 text-white transition-all hover:scale-110 backdrop-blur-sm"
                    aria-label="Previous video"
                >
                    <ChevronLeft size={24} />
                </button>
            )}

            {/* Next button */}
            {hasNext && (
                <button
                    onClick={() => onNavigate(videos[currentIndex + 1])}
                    className="absolute right-3 md:right-6 z-10 p-3 rounded-full bg-white/10 hover:bg-white/20 text-white transition-all hover:scale-110 backdrop-blur-sm"
                    aria-label="Next video"
                >
                    <ChevronRight size={24} />
                </button>
            )}

            {/* Video container */}
            <div className="relative z-10 w-full max-w-[420px] mx-4 aspect-[9/16] rounded-2xl overflow-hidden shadow-2xl border border-white/10 bg-black">
                {/* Background blur poster */}
                <div
                    className="absolute inset-0 bg-cover bg-center blur-2xl opacity-30 pointer-events-none scale-110"
                    style={{ backgroundImage: `url(${optimizedPosterUrl})` }}
                />

                <video
                    ref={videoRef}
                    key={video.id}
                    src={optimizedVideoUrl}
                    poster={optimizedPosterUrl}
                    className="h-full w-full object-cover relative z-10 cursor-pointer"
                    loop
                    playsInline
                    muted={isMuted}
                    preload="metadata"
                    onClick={togglePlayPause}
                    onContextMenu={e => e.preventDefault()}
                />

                {/* Play indicator (shown when paused) */}
                {!isPlaying && (
                    <div className="absolute inset-0 flex items-center justify-center z-20 pointer-events-none">
                        <div className="p-4 rounded-full bg-black/40 backdrop-blur-sm">
                            <Play size={40} className="text-white ml-1" fill="white" />
                        </div>
                    </div>
                )}

                {/* Mute toggle */}
                <button
                    onClick={toggleMute}
                    className="absolute top-4 right-4 z-20 p-2 bg-black/40 backdrop-blur-md rounded-full text-white/80 hover:text-white transition-colors"
                >
                    {isMuted ? <VolumeX size={18} /> : <Volume2 size={18} />}
                </button>

                {/* Bottom gradient */}
                <div className="absolute bottom-0 left-0 right-0 h-1/3 bg-gradient-to-t from-black/80 to-transparent z-10 pointer-events-none" />

                {/* Caption overlay */}
                <div className="absolute bottom-4 left-4 right-4 z-20">
                    <p className="text-white text-sm font-medium line-clamp-2 drop-shadow-md">
                        {video.caption}
                    </p>
                    <div className="flex items-center gap-4 mt-2 text-white/60 text-xs font-semibold">
                        <span>❤️ {video.likes_count || 0}</span>
                        <span>👁️ {video.view_count || 0}</span>
                    </div>
                </div>

                {/* Counter */}
                <div className="absolute top-4 left-4 z-20 px-3 py-1 bg-black/40 backdrop-blur-sm rounded-full text-white text-xs font-bold">
                    {currentIndex + 1} / {videos.length}
                </div>
            </div>
        </div>
    )
}
