'use client'

import { useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X } from 'lucide-react'
import ModalRoot from '@/components/ui/ModalRoot'

interface AvatarViewerModalProps {
    isOpen: boolean
    onClose: () => void
    src: string
    alt: string
}

export function AvatarViewerModal({ isOpen, onClose, src, alt }: AvatarViewerModalProps) {
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
        if (isOpen) {
            window.addEventListener('keydown', handleKeyDown)
        }
        return () => window.removeEventListener('keydown', handleKeyDown)
    }, [isOpen, onClose])

    return (
        <ModalRoot>
            <AnimatePresence>
                {isOpen && (
                    <div className="fixed inset-0 z-[100] flex items-center justify-center">
                        {/* Backdrop */}
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            transition={{ duration: 0.25 }}
                            className="absolute inset-0 bg-black/80 backdrop-blur-md"
                            onClick={onClose}
                        />

                        {/* Close Button */}
                        <button
                            onClick={onClose}
                            className="absolute top-4 right-4 z-[101] p-2 text-white/70 hover:text-white bg-black/50 rounded-full transition-colors"
                        >
                            <X size={24} />
                        </button>

                        {/* Avatar Image */}
                        <motion.div
                            initial={{ scale: 0.8, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            exit={{ scale: 0.8, opacity: 0 }}
                            transition={{ duration: 0.25, type: 'spring', damping: 25, stiffness: 300 }}
                            className="relative z-[101] w-full max-w-sm aspect-square p-4"
                            onClick={(e) => e.stopPropagation()} // Prevent backdrop click when clicking the image
                        >
                            <img
                                src={src}
                                alt={alt}
                                className="w-full h-full object-contain rounded-full shadow-2xl bg-gray-900 border-2 border-white/20"
                            />
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
        </ModalRoot>
    )
}
