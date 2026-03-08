'use client'

import { memo, useState } from 'react'
import { usePathname } from 'next/navigation'
import { motion } from 'framer-motion'
import { AvatarViewerModal } from './AvatarViewerModal'

interface ClickableAvatarProps {
    src: string | null
    username?: string
    fallbackText?: string
    className?: string
    hasStory?: boolean
    storyViewed?: boolean
}

function ClickableAvatarComponent({ src, username, fallbackText, className = "", hasStory = false, storyViewed = false }: ClickableAvatarProps) {
    const [isOpen, setIsOpen] = useState(false)
    const pathname = usePathname()
    const isProfilePage = pathname.startsWith('/profile')

    // Fallback logic
    const displayChar = fallbackText || username?.[0]?.toUpperCase() || '?'

    // Ring Styles
    const ringClass = hasStory
        ? storyViewed
            ? "bg-gray-400 p-[2px] rounded-full"
            : "bg-gradient-to-tr from-[#f58529] via-[#dd2a7b] to-[#8134af] p-[2px] rounded-full"
        : ""

    return (
        <>
            <motion.div
                whileTap={{ scale: 0.95 }}
                onClick={(e) => {
                    if (isProfilePage) {
                        e.preventDefault()
                        e.stopPropagation()
                        setIsOpen(true)
                    }
                    // Non-profile pages: let the click propagate to parent <Link>
                }}
                className={`cursor-pointer ${ringClass} ${className}`}
                aria-label={username ? `View ${username}'s avatar` : 'View avatar'}
            >
                <div className="w-full h-full rounded-full overflow-hidden bg-black border-[2px] border-transparent">
                    {src ? (
                        <img
                            src={src}
                            alt={username || 'Avatar'}
                            className="w-full h-full object-cover rounded-full"
                        />
                    ) : (
                        <div className="w-full h-full flex items-center justify-center bg-gradient-to-tr from-brand-secondary to-brand-primary text-white font-bold h-full rounded-full">
                            {displayChar}
                        </div>
                    )}
                </div>
            </motion.div>

            {isProfilePage && isOpen && (
                <AvatarViewerModal
                    isOpen={isOpen}
                    onClose={() => setIsOpen(false)}
                    src={src || ''}
                    alt={username || 'Avatar'}
                />
            )}
        </>
    )
}

export const ClickableAvatar = memo(ClickableAvatarComponent)
