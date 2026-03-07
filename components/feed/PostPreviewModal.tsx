'use client'

import { useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Video } from '@/types'
import { getOptimizedVideoUrl, getOptimizedPosterUrl } from '@/lib/utils/video-utils'
import { Heart, MessageCircle, UserPlus, UserCheck } from 'lucide-react'
import { ClickableAvatar } from '@/components/profile/ClickableAvatar'
import ModalRoot from '@/components/ui/ModalRoot'

interface PostPreviewModalProps {
    isOpen: boolean
    onClose: () => void
    video: Video | null
    isFollowing?: boolean
}

export function PostPreviewModal({ isOpen, onClose, video, isFollowing = false }: PostPreviewModalProps) {
    const videoRef = useRef<HTMLVideoElement>(null)

    // Lock body scroll and handle escape
    useEffect(() => {
        if (isOpen) {
            document.body.style.overflow = 'hidden'
        } else {
            document.body.style.overflow = ''
        }
        return () => {
            document.body.style.overflow = ''
        }
    }, [isOpen])

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') onClose()
        }
        if (isOpen) window.addEventListener('keydown', handleKeyDown)
        return () => window.removeEventListener('keydown', handleKeyDown)
    }, [isOpen, onClose])

    return (
        <ModalRoot>
            <AnimatePresence>
                {isOpen && video && (
                    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-8">
                        {/* Backdrop (tap to close) */}
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            transition={{ duration: 0.2 }}
                            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
                            onClick={onClose}
                        />

                        {/* Modal Container */}
                        <motion.div
                            initial={{ scale: 0.9, opacity: 0, y: 20 }}
                            animate={{ scale: 1, opacity: 1, y: 0 }}
                            exit={{ scale: 0.9, opacity: 0, y: 20 }}
                            transition={{ duration: 0.2, ease: "easeOut" }}
                            onClick={(e) => e.stopPropagation()}
                            className="relative z-[101] w-full max-w-sm bg-gray-900 rounded-3xl overflow-hidden border border-white/10 shadow-2xl flex flex-col max-h-[90vh]"
                        >
                            {/* Header: User Info */}
                            <div className="flex items-center justify-between p-4 border-b border-white/10 shrink-0">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-full bg-gray-800 overflow-hidden border border-white/10 shrink-0">
                                        <ClickableAvatar
                                            src={video.users?.avatar_url || null}
                                            username={video.users?.username}
                                            className="w-full h-full"
                                        />
                                    </div>
                                    <span className="font-bold text-white">@{video.users?.username}</span>
                                </div>

                                {!isFollowing ? (
                                    <button className="flex items-center gap-1 text-xs font-bold bg-brand-accent text-white px-3 py-1.5 rounded-full">
                                        <UserPlus size={14} />
                                        Follow
                                    </button>
                                ) : (
                                    <div className="flex items-center gap-1 text-xs font-bold bg-white/10 text-white px-3 py-1.5 rounded-full">
                                        <UserCheck size={14} />
                                        Following
                                    </div>
                                )}
                            </div>

                            {/* Media Preview */}
                            <div className="relative w-full aspect-[9/16] max-h-[50vh] bg-black overflow-hidden shrink-0">
                                {video.media_type === 'photo' ? (
                                    <img
                                        src={video.video_url}
                                        alt={video.caption || 'Preview'}
                                        className="w-full h-full object-cover"
                                    />
                                ) : (
                                    <video
                                        ref={videoRef}
                                        src={getOptimizedVideoUrl(video.video_url)}
                                        poster={getOptimizedPosterUrl(video.video_url)}
                                        className="w-full h-full object-cover"
                                        loop
                                        playsInline
                                        muted
                                        autoPlay
                                        preload="metadata"
                                    />
                                )}
                            </div>

                            {/* Footer: Metadata */}
                            <div className="p-4 flex flex-col gap-3 overflow-y-auto">
                                <p className="text-sm text-white/90 line-clamp-3">
                                    {video.caption}
                                </p>
                                <div className="flex items-center gap-6 mt-1 opacity-70">
                                    <div className="flex items-center gap-1.5 text-sm font-semibold">
                                        <Heart size={16} />
                                        <span>{video.likes_count || 0}</span>
                                    </div>
                                    <div className="flex items-center gap-1.5 text-sm font-semibold">
                                        <MessageCircle size={16} />
                                        <span>{video.comments_count || 0}</span>
                                    </div>
                                </div>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
        </ModalRoot>
    )
}
