'use client'

import { useEffect, useRef, useState } from 'react'
import { ArrowLeft } from 'lucide-react'
import { Video } from '@/types'
import { ProfileVideoItem } from './ProfileVideoItem'
import ModalRoot from '@/components/ui/ModalRoot'

interface ProfilePostViewerProps {
    posts: Video[]
    startIndex: number
    onClose: () => void
}

export function ProfilePostViewer({ posts, startIndex, onClose }: ProfilePostViewerProps) {
    const containerRef = useRef<HTMLDivElement>(null)
    const itemRefs = useRef<(HTMLDivElement | null)[]>([])
    const [activeIndex, setActiveIndex] = useState(startIndex)

    // Body scroll lock and Escape key listener
    useEffect(() => {
        document.body.style.overflow = 'hidden'

        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') onClose()
        }
        document.addEventListener('keydown', handleKeyDown)

        return () => {
            document.body.style.overflow = ''
            document.removeEventListener('keydown', handleKeyDown)
        }
    }, [onClose])

    // Scroll to starting index on mount
    useEffect(() => {
        const targetElement = itemRefs.current[startIndex]
        if (targetElement && containerRef.current) {
            // Using auto so it immediately snaps without seeing the fast-forward scroll
            targetElement.scrollIntoView({ behavior: 'auto', block: 'start' })
        }
    }, [startIndex])

    // Update active index based on scroll position using a scroll listener (optional fallback if IntersectionObserver at children behaves oddly for 'active' tracking)
    const handleScroll = () => {
        if (!containerRef.current) return
        const scrollTop = containerRef.current.scrollTop
        const viewportHeight = window.innerHeight
        const newIndex = Math.round(scrollTop / viewportHeight)
        if (newIndex !== activeIndex && newIndex >= 0 && newIndex < posts.length) {
            setActiveIndex(newIndex)
        }
    }

    return (
        <ModalRoot>
            <div
                className="fixed inset-0 z-[9999] bg-black"
                role="dialog"
                aria-modal="true"
            >
                {/* Top Navigation Overlay */}
                <div className="absolute top-0 left-0 right-0 z-[10000] p-4 pt-safe flex items-center bg-gradient-to-b from-black/60 to-transparent pointer-events-none">
                    <button
                        onClick={onClose}
                        className="p-3 bg-black/40 hover:bg-black/60 backdrop-blur-md rounded-full text-white transition-colors pointer-events-auto"
                        aria-label="Back to profile"
                    >
                        <ArrowLeft size={24} />
                    </button>
                </div>

                {/* Vertically Scrolling Snap Container */}
                <div
                    ref={containerRef}
                    onScroll={handleScroll}
                    className="w-full h-[100dvh] overflow-y-scroll snap-y snap-mandatory hide-scrollbar"
                    style={{ scrollBehavior: 'auto' }}
                >
                    {posts.map((video, idx) => (
                        <div
                            key={video.id}
                            ref={(el) => { itemRefs.current[idx] = el }}
                            className="w-full h-[100dvh] snap-start"
                        >
                            {/* 
                            We pass the isActive prop down to tell the child 
                            if it is the primary focused item in the window. 
                            */}
                            <ProfileVideoItem
                                video={video}
                                isActive={idx === activeIndex}
                            />
                        </div>
                    ))}
                </div>
            </div>
        </ModalRoot>
    )
}
