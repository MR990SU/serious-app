'use client'

import { useState } from 'react'
import { X, Link2, Facebook, MessageCircle, Mail, Twitter } from 'lucide-react'
// Note: Threads icon isn't standard in lucide-react, using a generic MessageSquare or AtSign instead for now context
import { AtSign } from 'lucide-react'

interface ShareModalProps {
    url: string
    title: string
    isOpen: boolean
    onClose: () => void
}

export function ShareModal({ url, title, isOpen, onClose }: ShareModalProps) {
    const [showToast, setShowToast] = useState(false)

    if (!isOpen) return null

    const handleCopy = async () => {
        try {
            if (navigator.clipboard && navigator.clipboard.writeText) {
                await navigator.clipboard.writeText(url)
            } else {
                const el = document.createElement('textarea')
                el.value = url
                document.body.appendChild(el)
                el.select()
                document.execCommand('copy')
                document.body.removeChild(el)
            }
            setShowToast(true)
            setTimeout(() => {
                setShowToast(false)
                onClose()
            }, 2000)
        } catch (e) {
            console.error("Copy failed", e)
            alert("Failed to copy link")
            onClose()
        }
    }

    const shareOptions = [
        { name: 'Copy link', icon: Link2, action: handleCopy },
        { name: 'Facebook', icon: Facebook, action: () => window.open(`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`, '_blank') },
        // Using standard WhatsApp URL scheme for web/mobile
        { name: 'WhatsApp', icon: MessageCircle, action: () => window.open(`https://api.whatsapp.com/send?text=${encodeURIComponent(title + " " + url)}`, '_blank') },
        { name: 'Email', icon: Mail, action: () => window.open(`mailto:?subject=${encodeURIComponent(title)}&body=${encodeURIComponent(url)}`, '_blank') },
        { name: 'Threads', icon: AtSign, action: () => window.open(`https://threads.net/intent/post?text=${encodeURIComponent(title + " " + url)}`, '_blank') },
        { name: 'X', icon: Twitter, action: () => window.open(`https://twitter.com/intent/tweet?url=${encodeURIComponent(url)}&text=${encodeURIComponent(title)}`, '_blank') },
    ]

    return (
        <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center pointer-events-auto">
            {/* Backdrop */}
            <div
                className="absolute inset-0 bg-black/60 backdrop-blur-sm"
                onClick={onClose}
            />

            {/* Modal Content */}
            <div className="bg-gray-900 border border-white/10 w-full sm:w-[400px] sm:rounded-2xl rounded-t-2xl p-6 relative z-10 animate-in slide-in-from-bottom-full sm:slide-in-from-bottom-0 sm:fade-in duration-300">
                {/* Toast Notification */}
                {showToast && (
                    <div className="absolute -top-14 left-1/2 -translate-x-1/2 bg-white text-black font-bold px-4 py-2 rounded-full shadow-lg z-50 text-sm animate-in fade-in slide-in-from-bottom-2">
                        Copied to clipboard!
                    </div>
                )}

                <div className="flex justify-between items-center mb-6">
                    <h3 className="font-bold text-lg text-white mx-auto">Share to</h3>
                    <button onClick={onClose} className="absolute left-6 text-gray-400 hover:text-white transition-colors">
                        <X size={24} />
                    </button>
                </div>

                {/* Since "Messages" is explicitly excluded from the screenshot options, we skip 'Messenger' / direct message options mapped in the UI except pure social networks */}
                <div className="grid grid-cols-3 gap-y-6 gap-x-2">
                    {shareOptions.map((option) => (
                        <button
                            key={option.name}
                            onClick={option.action}
                            className="flex flex-col items-center gap-2 group"
                        >
                            <div className="w-[60px] h-[60px] rounded-full bg-white/5 border border-white/10 flex items-center justify-center group-hover:bg-white/10 transition-colors">
                                <option.icon size={26} className="text-white" />
                            </div>
                            <span className="text-xs text-gray-300 font-medium">{option.name}</span>
                        </button>
                    ))}
                </div>

            </div>
        </div>
    )
}
