'use client'

import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'

interface HeartAnimationProps {
    triggerTimestamp: number
}

export function HeartAnimation({ triggerTimestamp }: HeartAnimationProps) {
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
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-50">
                    <motion.div
                        initial={{ scale: 0.2, opacity: 0 }}
                        animate={{ scale: [0.2, 1.2, 1], opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.6 }}
                        className="text-red-500 drop-shadow-[0_0_30px_rgba(239,68,68,0.8)]"
                    >
                        ❤️
                    </motion.div>
                </div>
            )}
        </AnimatePresence>
    )
}
