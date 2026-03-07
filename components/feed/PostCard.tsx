'use client'

import { memo, useState, useEffect, useRef } from 'react'
import Image from 'next/image'
import { Video } from '@/types'
import { getThumbnailUrl } from '@/lib/utils/video-utils'
import { useLongPress } from '@/hooks/useLongPress'
import { PostPreviewModal } from './PostPreviewModal'
import { HeartAnimation } from '@/components/ui/HeartAnimation'
import { toggleLike } from '@/app/actions/video-actions'
import { createClient } from '@/lib/supabase/client'

interface PostCardProps {
    video: Video
    onClick: () => void
    className?: string
}

function PostCardComponent({ video, onClick, className = '' }: PostCardProps) {
    const [isPreviewOpen, setIsPreviewOpen] = useState(false)
    const [heartTrigger, setHeartTrigger] = useState(0)
    const lastTapRef = useRef(0)

    // Check initial like state so we logically ignore duplicate API calls (but still animate)
    const [isLiked, setIsLiked] = useState(false)
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

    const handleDoubleTapLike = async () => {
        setHeartTrigger(Date.now()) // Fire animation regardless of state

        if (!isLiked) {
            setIsLiked(true) // Optimistic state
            const result = await toggleLike(video.id)
            if (!result || !result.success) {
                setIsLiked(false) // Revert on failure
            }
        }
    }

    const longPressProps = useLongPress({
        onLongPress: () => {
            setIsPreviewOpen(true)
        },
        onClick: () => {
            const now = Date.now()
            if (now - lastTapRef.current < 300) {
                handleDoubleTapLike()
            } else {
                // To allow a single click vs double tap to not conflict perfectly on desktop, 
                // typically we want a slight delay, but standard tap opens it natively on release.
                setTimeout(() => {
                    const latest = Date.now()
                    if (latest - lastTapRef.current >= 300) {
                        onClick()
                    }
                }, 300)
            }
            lastTapRef.current = now
        },
        delay: 350
    })

    const thumbSource = getThumbnailUrl(video.video_url)

    return (
        <>
            <div
                {...longPressProps}
                className={`relative group bg-gray-900 overflow-hidden cursor-pointer select-none touch-manipulation ${className}`}
                aria-label={`Video by ${video.users?.username}`}
            >
                {/* Thumbnail Layer */}
                <div className="absolute inset-0">
                    <Image
                        src={thumbSource}
                        alt={video.caption || 'Video'}
                        fill
                        sizes="(max-width: 640px) 50vw, 33vw"
                        unoptimized={thumbSource.includes('supabase.co')}
                        className="object-cover group-hover:scale-105 transition-transform duration-500"
                        loading="lazy"
                    />
                </div>

                {/* Meta Overlay */}
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex items-end p-2 pointer-events-none z-10">
                    <span className="text-white text-xs font-semibold drop-shadow-md">
                        @{video.users?.username}
                    </span>
                    <div className="absolute bottom-1 right-2 flex items-center gap-1 text-white text-[10px] font-bold drop-shadow-md">
                        <svg className="w-2.5 h-2.5 stroke-white fill-transparent" viewBox="0 0 24 24" strokeWidth="2"><path d="m2 12 5.25 5L22 4"></path></svg>
                        {video.view_count || 0}
                    </div>
                </div>

                {/* Heart Animation Overlay */}
                <HeartAnimation triggerTimestamp={heartTrigger} />
            </div>

            {/* Modal mounted conditionally to prevent offscreen rendering */}
            {isPreviewOpen && (
                <PostPreviewModal
                    isOpen={isPreviewOpen}
                    onClose={() => setIsPreviewOpen(false)}
                    video={video}
                />
            )}
        </>
    )
}

export const PostCard = memo(PostCardComponent)
