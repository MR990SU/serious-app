'use client'
import { useRef, useState, useEffect } from 'react'
import { getOptimizedVideoUrl, getOptimizedPosterUrl } from '@/lib/utils/video-utils'
import { Volume2, VolumeX, Music } from 'lucide-react'
import ActionButtons from '@/components/feed/ActionButtons'
import Link from 'next/link'
import { useVideoStore } from '@/lib/store/useVideoStore'
import { incrementViewCount } from '@/app/actions/video-actions'
import type { Video } from '@/types'

interface Props {
    video: Video
}

/**
 * ReelPageClient — interactive client island for the /reel/[id] route.
 * Handles video playback, mute toggle, view counting, and interactive buttons.
 * Data is pre-fetched server-side; this component only adds interactivity.
 */
export default function ReelPageClient({ video }: Props) {
    const { setActiveVideo } = useVideoStore()
    const videoRef = useRef<HTMLVideoElement>(null)
    const [isMuted, setIsMuted] = useState(false)
    const [isExpanded, setIsExpanded] = useState(false)
    const viewLogged = useRef(false)

    useEffect(() => {
        setActiveVideo(video.id, video.likes_count ?? 0, video.comments_count ?? 0)

        const vEl = videoRef.current
        if (!vEl) return
        vEl.play().catch(() => { })

        if (!viewLogged.current) {
            viewLogged.current = true
            incrementViewCount(video.id)
        }

        return () => {
            vEl.pause()
        }
    }, [video.id])

    const toggleMute = () => {
        if (videoRef.current) {
            videoRef.current.muted = !isMuted
            setIsMuted(!isMuted)
        }
    }

    return (
        <div className="relative h-[100dvh] w-full flex items-center justify-center bg-black overflow-hidden">
            {/* Video */}
            <video
                ref={videoRef}
                src={getOptimizedVideoUrl(video.video_url)}
                poster={getOptimizedPosterUrl(video.video_url)}
                className="h-full w-full object-cover"
                loop
                playsInline
                muted={isMuted}
                preload="auto"
            />

            {/* Mute toggle */}
            <button
                onClick={toggleMute}
                className="absolute top-16 right-4 z-20 p-2 bg-black/40 backdrop-blur-md rounded-full text-white/80 hover:text-white transition-colors"
                aria-label={isMuted ? 'Unmute' : 'Mute'}
            >
                {isMuted ? <VolumeX size={20} /> : <Volume2 size={20} />}
            </button>

            {/* Bottom gradient */}
            <div className="absolute bottom-0 left-0 right-0 h-1/2 bg-gradient-to-t from-black/80 via-black/40 to-transparent z-10 pointer-events-none" />

            {/* Caption & username */}
            <div className="absolute bottom-20 left-4 right-20 z-20">
                <Link href={`/profile/${video.users?.id}`} className="font-bold text-lg hover:underline flex items-center gap-2 mb-2 text-white">
                    @{video.users?.username}
                </Link>
                <div className="text-sm text-white">
                    <p className={`${isExpanded ? '' : 'line-clamp-2'} transition-all`}>
                        {video.caption}
                    </p>
                    {video.caption && video.caption.length > 50 && (
                        <button onClick={() => setIsExpanded(!isExpanded)} className="font-bold text-white/70 hover:text-white mt-1">
                            {isExpanded ? 'less' : 'more'}
                        </button>
                    )}
                </div>
                <div className="flex items-center gap-2 mt-4 text-sm font-semibold text-white/80 overflow-hidden w-64 rounded-full px-3 py-1 glass max-w-full">
                    <Music size={16} className="shrink-0 text-brand-secondary animate-pulse" />
                    <p className="animate-[scroll_10s_linear_infinite] inline-block whitespace-nowrap">
                        {video.caption ? `${video.caption} • ` : `Original Sound - @${video.users?.username} • `}
                    </p>
                </div>
            </div>

            {/* Action buttons — avatarless version for reel detail page */}
            <ActionButtons video={video} />
        </div>
    )
}
