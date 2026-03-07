'use client'

import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Heart } from 'lucide-react'

interface HeartAnimationProps {
    triggerTimestamp: number; // Update this to fire the animation
}

export function HeartAnimation({ triggerTimestamp }: HeartAnimationProps) {
    const [isVisible, setIsVisible] = useState(false)

    useEffect(() => {
        if (triggerTimestamp > 0) {
            setIsVisible(true)
            const timer = setTimeout(() => setIsVisible(false), 800)
            return () => clearTimeout(timer)
        }
    }, [triggerTimestamp])

    return (
        <AnimatePresence>
            {isVisible && (
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-50 overflow-hidden">
                    {/* Core heart */}
                    <motion.div
                        initial={{ scale: 0, opacity: 0 }}
                        animate={{
                            scale: [0, 1.3, 1],
                            opacity: [0, 1, 1, 0]
                        }}
                        exit={{ opacity: 0, scale: 0.8 }}
                        transition={{
                            duration: 0.7,
                            ease: "easeOut",
                            times: [0, 0.4, 0.7, 1]
                        }}
                        className="relative"
                    >
                        <Heart
                            size={100}
                            className="text-white drop-shadow-2xl fill-white"
                        />

                        {/* Fake burst particles using secondary animated elements behind */}
                        <motion.div
                            className="absolute inset-0 flex items-center justify-center"
                            initial={{ scale: 0.5, opacity: 1 }}
                            animate={{ scale: 1.8, opacity: 0 }}
                            transition={{ duration: 0.5, ease: "easeOut", delay: 0.1 }}
                        >
                            <div className="w-full h-full rounded-full border-4 border-white opacity-50 absolute" />
                        </motion.div>
                    </motion.div>
                </div>
            )}
        </AnimatePresence>
    )
}
