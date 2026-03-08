'use client'

import { useRouter } from 'next/navigation'
import { useRef, ReactNode } from 'react'

const routes = [
    '/',
    '/discover',
    '/upload',
    '/notifications',
    '/profile/me'
]

interface Props {
    children: ReactNode
}

export default function SwipeNavigator({ children }: Props) {
    const router = useRouter()
    const start = useRef({ x: 0, y: 0 })

    const handleStart = (e: React.TouchEvent) => {
        start.current = {
            x: e.touches[0].clientX,
            y: e.touches[0].clientY
        }
    }

    const handleEnd = (e: React.TouchEvent) => {
        const dx = e.changedTouches[0].clientX - start.current.x
        const dy = e.changedTouches[0].clientY - start.current.y

        if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy)) {
            const index = routes.indexOf(window.location.pathname)

            if (dx < 0 && routes[index + 1]) {
                router.push(routes[index + 1])
            }

            if (dx > 0 && routes[index - 1]) {
                router.push(routes[index - 1])
            }
        }
    }

    return (
        <div
            onTouchStart={handleStart}
            onTouchEnd={handleEnd}
            className="h-full w-full"
        >
            {children}
        </div>
    )
}
