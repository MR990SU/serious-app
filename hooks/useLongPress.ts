import { useCallback, useRef } from 'react'

interface UseLongPressOptions {
    onLongPress: () => void
    onClick: () => void
    delay?: number
}

export function useLongPress({ onLongPress, onClick, delay = 350 }: UseLongPressOptions) {
    const timeout = useRef<NodeJS.Timeout | null>(null)
    const hoverTimeout = useRef<NodeJS.Timeout | null>(null)
    const isLongPressActive = useRef(false)
    const isHoverActive = useRef(false)
    const preventClick = useRef(false)
    const isTouch = useRef(false)

    const clearTimeouts = useCallback(() => {
        if (timeout.current) clearTimeout(timeout.current)
        if (hoverTimeout.current) clearTimeout(hoverTimeout.current)
    }, [])

    const startPress = useCallback(() => {
        preventClick.current = false
        isLongPressActive.current = false

        timeout.current = setTimeout(() => {
            isLongPressActive.current = true
            preventClick.current = true
            onLongPress()
        }, delay)
    }, [onLongPress, delay])

    const startHover = useCallback(() => {
        if (isTouch.current) return // Desktop only
        isHoverActive.current = false

        hoverTimeout.current = setTimeout(() => {
            isHoverActive.current = true
            onLongPress()
        }, delay)
    }, [onLongPress, delay])

    const clearHover = useCallback(() => {
        if (hoverTimeout.current) clearTimeout(hoverTimeout.current)
        isHoverActive.current = false
    }, [])

    const clearPress = useCallback(() => {
        if (timeout.current) clearTimeout(timeout.current)

        // If it was a quick tap/click and not a long press, trigger click
        // But only if we aren't currently triggering a hover preview
        if (!isLongPressActive.current && !preventClick.current && !isHoverActive.current) {
            onClick()
        }

        isLongPressActive.current = false
    }, [onClick])

    return {
        // Touch events (Mobile)
        onTouchStart: () => {
            isTouch.current = true
            startPress()
        },
        onTouchEnd: () => {
            clearPress()
        },
        onTouchCancel: () => {
            clearTimeouts()
            isLongPressActive.current = false
        },

        // Mouse events (Desktop) - Hover
        onMouseEnter: () => startHover(),
        onMouseLeave: () => {
            clearHover()
            clearTimeouts() // Also clear click hold if left early
            isLongPressActive.current = false
        },

        // Mouse events (Desktop) - Click
        onMouseDown: (e: React.MouseEvent) => {
            if (isTouch.current) return // Disable conflicting mouse events from touch delay mappings
            if (e.button !== 0) return // Allow only left click
            // If hover already opened preview, don't restart hold timer
            if (isHoverActive.current) return
            startPress()
        },
        onMouseUp: () => {
            // Only trigger clearPress (which checks for onClick) if we weren't just hovering
            if (!isHoverActive.current) {
                clearPress()
            } else {
                clearTimeouts()
            }
        },
    }
}
