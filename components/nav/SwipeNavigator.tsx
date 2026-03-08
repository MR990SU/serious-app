'use client'

import { useRef, ReactNode } from 'react'
import { usePathname, useRouter } from 'next/navigation'

const TAB_ORDER = ['/', '/discover', '/upload', '/notifications', '/profile/me']
const MIN_SWIPE_DISTANCE = 50

interface Props {
    children: ReactNode
}

export default function SwipeNavigator({ children }: Props) {
    const pathname = usePathname()
    const router = useRouter()
    const touchStartRef = useRef<{ x: number; y: number } | null>(null)

    const handleTouchStart = (e: React.TouchEvent) => {
        const touch = e.touches[0]
        touchStartRef.current = { x: touch.clientX, y: touch.clientY }
    }

    const handleTouchEnd = (e: React.TouchEvent) => {
        if (!touchStartRef.current) return
        const touch = e.changedTouches[0]
        const deltaX = touch.clientX - touchStartRef.current.x
        const deltaY = touch.clientY - touchStartRef.current.y
        touchStartRef.current = null

        // Vertical guard — only fire on truly horizontal swipes
        if (Math.abs(deltaX) < MIN_SWIPE_DISTANCE || Math.abs(deltaX) < Math.abs(deltaY)) return

        // Find current tab index — match the closest prefix
        const currentIndex = TAB_ORDER.findIndex(tab =>
            tab === '/' ? pathname === '/' : pathname.startsWith(tab)
        )
        if (currentIndex === -1) return

        if (deltaX < 0 && currentIndex < TAB_ORDER.length - 1) {
            // Swipe left → next tab
            router.push(TAB_ORDER[currentIndex + 1])
        } else if (deltaX > 0 && currentIndex > 0) {
            // Swipe right → previous tab
            router.push(TAB_ORDER[currentIndex - 1])
        }
    }

    return (
        <div
            onTouchStart={handleTouchStart}
            onTouchEnd={handleTouchEnd}
            className="h-full w-full"
        >
            {children}
        </div>
    )
}
