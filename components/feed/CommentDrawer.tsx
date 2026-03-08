'use client'

import { useEffect, useRef } from 'react'
import { X } from 'lucide-react'
import { CommentsSection } from './CommentsSection'
import { useVideoStore } from '@/lib/store/useVideoStore'

interface CommentDrawerProps {
    isOpen: boolean
    onClose: () => void
}

export function CommentDrawer({ isOpen, onClose }: CommentDrawerProps) {
    const { activeVideoComments } = useVideoStore()
    const drawerRef = useRef<HTMLDivElement>(null)

    // Close on Escape key
    useEffect(() => {
        const handleKey = (e: KeyboardEvent) => {
            if (e.key === 'Escape') onClose()
        }
        if (isOpen) document.addEventListener('keydown', handleKey)
        return () => document.removeEventListener('keydown', handleKey)
    }, [isOpen, onClose])

    // Prevent body scroll when drawer is open
    useEffect(() => {
        if (isOpen) {
            document.body.style.overflow = 'hidden'
        } else {
            document.body.style.overflow = ''
        }
        return () => { document.body.style.overflow = '' }
    }, [isOpen])

    if (!isOpen) return null

    return (
        // Full-screen overlay — must be above video but below nothing
        <div className="fixed inset-0 z-[200] flex flex-col justify-end lg:hidden" aria-modal="true" role="dialog">
            {/* Backdrop */}
            <div
                className="absolute inset-0 bg-black/60 backdrop-blur-sm"
                onClick={onClose}
            />

            {/* Drawer panel — slides up from bottom */}
            <div
                ref={drawerRef}
                className="relative bg-gray-950 border-t border-white/10 rounded-t-3xl flex flex-col"
                style={{ height: '80dvh', maxHeight: '80dvh' }}
            >
                {/* Drag handle */}
                <div className="flex-shrink-0 flex items-center justify-center pt-3 pb-1">
                    <div className="w-10 h-1 rounded-full bg-white/20" />
                </div>

                {/* Header */}
                <div className="flex-shrink-0 flex items-center justify-between px-4 pb-3 border-b border-white/10">
                    <h2 className="font-bold text-white text-base">
                        {activeVideoComments > 0 ? `${activeVideoComments} Comments` : 'Comments'}
                    </h2>
                    <button
                        onClick={onClose}
                        className="p-2 rounded-full hover:bg-white/10 text-gray-400 hover:text-white transition-colors"
                        aria-label="Close comments"
                    >
                        <X size={20} />
                    </button>
                </div>

                {/* Comments content — fills remaining space */}
                <div className="flex-1 overflow-hidden px-2 pt-2 pb-4">
                    <CommentsSection />
                </div>
            </div>
        </div>
    )
}
