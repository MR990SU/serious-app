'use client'

import { useRef, useEffect, useState, memo } from 'react'
import { useInView } from 'react-intersection-observer'
import { Video } from '@/types'
import { getOptimizedVideoUrl, getOptimizedPosterUrl } from '@/lib/utils/video-utils'
import { Heart, MessageCircle, Play } from 'lucide-react'
import Image from 'next/image'
import { HeartAnimation } from '@/components/ui/HeartAnimation'
import { toggleLike } from '@/app/actions/video-actions'
import { createClient } from '@/lib/supabase/client'

interface ProfileVideoItemProps {
    video: Video
    isActive: boolean // Whether this is the currently focused index
}

const ProfileVideoItemComponent = ({ video, isActive }: ProfileVideoItemProps) => {
    const videoRef = useRef<HTMLVideoElement>(null)
    const [isPlaying, setIsPlaying] = useState(false)
    const [videoReady, setVideoReady] = useState(false)

    // Heart Animation and Double Tap Mechanics
    const [heartTrigger, setHeartTrigger] = useState(0)
    const lastTapRef = useRef(0)
    const [isLiked, setIsLiked] = useState(false)
    const [localLikes, setLocalLikes] = useState(video.likes_count || 0)
    const supabase = createClient()

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
            setLocalLikes(prev => prev + 1)
            const result = await toggleLike(video.id)
            if (!result || !result.success) {
                setIsLiked(false)
                setLocalLikes(prev => prev - 1)
            }
        }
    }

    // Trigger exact viewport snap play/pause
    const { ref: viewRef, inView } = useInView({
        threshold: 0.6,
        rootMargin: '0px'
    })

    // Preload triggering early mounting
    const { ref: loadRef, inView: isNearInView } = useInView({
        rootMargin: '200px 0px',
        triggerOnce: false
    })

    const isVisibleOrNear = inView || isNearInView

    useEffect(() => {
        if (!videoRef.current) return

        if (inView && isActive) {
            const playPromise = videoRef.current.play()
            if (playPromise !== undefined) {
                playPromise.then(() => {
                    setIsPlaying(true)
                }).catch(err => {
                    console.error('Playback intercepted or failed', err)
                    setIsPlaying(false)
                })
            }
        } else {
            videoRef.current.pause()
            setIsPlaying(false)
            if (!inView && videoRef.current) {
                // reset position when completely out of view
                videoRef.current.currentTime = 0
            }
        }
    }, [inView, isActive])

    const handleTapSequence = (e: React.MouseEvent | React.TouchEvent) => {
        e.stopPropagation()
        const now = Date.now()
        if (now - lastTapRef.current < 300) {
            handleDoubleTap()
        } else {
            // single tap logic delayed
            setTimeout(() => {
                const latest = Date.now()
                if (latest - lastTapRef.current >= 300) {
                    togglePlay()
                }
            }, 300)
        }
        lastTapRef.current = now
    }

    const togglePlay = () => {
        if (!videoRef.current) return
        if (isPlaying) {
            videoRef.current.pause()
            setIsPlaying(false)
        } else {
            videoRef.current.play()
            setIsPlaying(true)
        }
    }

    const optimizedVideoUrl = getOptimizedVideoUrl(video.video_url)
    const optimizedPosterUrl = getOptimizedPosterUrl(video.video_url)

    // Merge refs for intersection observer
    const setRefs = (el: HTMLDivElement | null) => {
        viewRef(el)
        loadRef(el)
    }

    return (
        <div ref={setRefs} className="w-full h-[100dvh] snap-start relative bg-black flex items-center justify-center">
            <div className="relative w-full h-full md:max-w-[420px] mx-auto overflow-hidden bg-gray-900 border-x border-white/5">

                {/* Background Poster (blur) */}
                <div
                    className="absolute inset-0 bg-cover bg-center blur-2xl opacity-30 pointer-events-none scale-110"
                    style={{ backgroundImage: `url(${optimizedPosterUrl})` }}
                />

                {isVisibleOrNear ? (
                    video.media_type === 'photo' ? (
                        <Image
                            src={video.video_url}
                            alt={video.caption || 'Photo'}
                            fill
                            className="object-cover relative z-10"
                            unoptimized={video.video_url.includes('supabase.co')}
                        />
                    ) : (
                        <video
                            ref={videoRef}
                            src={optimizedVideoUrl}
                            poster={optimizedPosterUrl}
                            className="w-full h-full object-cover relative z-10 cursor-pointer"
                            loop
                            playsInline
                            muted={false} // Profile viewer typically starts with audio if user unmuted previously, but for safety let's leave default or mute if required.
                            preload="metadata"
                            onClick={handleTapSequence}
                            onLoadedData={() => setVideoReady(true)}
                            onContextMenu={e => e.preventDefault()}
                        />
                    )
                ) : (
                    // Placeholder when far out of view
                    <div
                        className="w-full h-full bg-cover bg-center relative z-10 opacity-50"
                        style={{ backgroundImage: `url(${optimizedPosterUrl})` }}
                    />
                )}

                {/* Play indicator (shown when paused) */}
                {!isPlaying && video.media_type !== 'photo' && (
                    <div className="absolute inset-0 flex items-center justify-center z-20 pointer-events-none">
                        <div className="p-4 rounded-full bg-black/40 backdrop-blur-sm">
                            <Play size={40} className="text-white ml-1" fill="white" />
                        </div>
                    </div>
                )}

                {/* Bottom Overlay Info */}
                <div className="absolute bottom-0 left-0 right-0 p-4 pt-20 bg-gradient-to-t from-black/90 via-black/40 to-transparent z-20 pointer-events-none">
                    <p className="text-white text-sm font-medium line-clamp-2 drop-shadow-md">
                        {video.caption}
                    </p>
                    <div className="flex items-center gap-4 mt-2 text-white/80 text-xs font-bold">
                        <div className={`flex items-center gap-1.5 bg-black/40 px-2 py-1 rounded-full backdrop-blur-sm transition-colors ${isLiked ? 'text-brand-accent' : ''}`}>
                            <Heart size={14} fill={isLiked ? 'currentColor' : 'none'} /> {localLikes}
                        </div>
                        <div className="flex items-center gap-1.5 bg-black/40 px-2 py-1 rounded-full backdrop-blur-sm">
                            <MessageCircle size={14} /> {video.comments_count || 0}
                        </div>
                        <div className="flex items-center gap-1.5 bg-black/40 px-2 py-1 rounded-full backdrop-blur-sm">
                            <svg className="w-3.5 h-3.5 stroke-white fill-transparent" viewBox="0 0 24 24" strokeWidth="2"><path d="m2 12 5.25 5L22 4"></path></svg>
                            {video.view_count || 0}
                        </div>
                    </div>
                </div>

                {/* Heart Trigger Overlay */}
                <HeartAnimation triggerTimestamp={heartTrigger} />
            </div>
        </div>
    )
}

export const ProfileVideoItem = memo(ProfileVideoItemComponent)
