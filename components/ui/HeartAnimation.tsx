'use client'

import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'

interface HeartAnimationProps {
    triggerTimestamp: number
    x?: number | null
    y?: number | null
}

export function HeartAnimation({ triggerTimestamp, x, y }: HeartAnimationProps) {
    const [isVisible, setIsVisible] = useState(false)

    useEffect(() => {
        if (triggerTimestamp > 0) {
            setIsVisible(true)
            const timer = setTimeout(() => setIsVisible(false), 600)
            return () => clearTimeout(timer)
        }
    }, [triggerTimestamp])

    return (
        <AnimatePresence>
            {isVisible && (
                <motion.div
                    key={triggerTimestamp}
                    initial={{ scale: 0.2, opacity: 0 }}
                    animate={{ scale: [0.2, 1.2, 1], opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.6 }}
                    className="text-red-500 drop-shadow-[0_0_30px_rgba(239,68,68,0.8)] pointer-events-none z-50"
                    style={{
                        position: 'absolute',
                        ...(x !== undefined && x !== null && y !== undefined && y !== null
                            ? { left: x - 40, top: y - 40 }
                            : { left: '50%', top: '50%', transform: 'translate(-50%, -50%)' }
                        ),
                        fontSize: 80,
                        lineHeight: 1,
                    }}
                >
                    ❤️
                </motion.div>
            )}
        </AnimatePresence>
    )
}
