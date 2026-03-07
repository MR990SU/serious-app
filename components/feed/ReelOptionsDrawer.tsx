'use client'
import { Drawer } from 'vaul'
import { Bookmark, Music, ShieldMinus, Ban, PlayCircle, Loader2 } from 'lucide-react'
import { Video } from '@/types'
import { useAuth } from '@/components/AuthProvider'
import { useVideoStore } from '@/lib/store/useVideoStore'
import { useState } from 'react'

interface Props {
    isOpen: boolean
    onClose: () => void
    video: Video
    savedReel: boolean
    onToggleSavedReel: () => void
    savedAudio: boolean
    onToggleSavedAudio: () => void
}

export function ReelOptionsDrawer({
    isOpen, onClose, video, savedReel, onToggleSavedReel, savedAudio, onToggleSavedAudio
}: Props) {
    const { user } = useAuth()
    const { autoPlayEnabled, setAutoPlayEnabled } = useVideoStore()
    const [toastMessage, setToastMessage] = useState<{ message: string, undoAction?: () => void } | null>(null)
    const [isProcessing, setIsProcessing] = useState(false)

    const showToast = (message: string, undoAction?: () => void) => {
        setToastMessage({ message, undoAction })
        setTimeout(() => setToastMessage(null), 4000)
    }

    const handleNotInterested = async (undo: boolean = false) => {
        if (!user || isProcessing) return
        setIsProcessing(true)

        try {
            const res = await fetch('/api/feed/not-interested', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ creator_id: video.users.id })
            })
            const data = await res.json()

            if (data.success) {
                if (!undo) {
                    showToast(`Show fewer reels from ${video.users.username}`, () => handleNotInterested(true))
                } else {
                    showToast(`Undo successful`)
                }
                if (!undo) onClose()
            }
        } catch { }
        setIsProcessing(false)
    }

    const handleBlockUser = async () => {
        if (!user || isProcessing) return
        setIsProcessing(true)

        try {
            const res = await fetch('/api/users/block', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ blocked_user_id: video.users.id })
            })
            const data = await res.json()

            if (data.success) {
                showToast(`Blocked ${video.users.username}. Refresh feed to update.`)
                onClose()
            }
        } catch { }
        setIsProcessing(false)
    }

    return (
        <Drawer.Root open={isOpen} onOpenChange={(open: boolean) => !open && onClose()}>
            <Drawer.Portal>
                <Drawer.Overlay className="fixed inset-0 bg-black/40 z-50 backdrop-blur-sm" onClick={onClose} />
                <Drawer.Content className="bg-[#111] border-t border-gray-800 flex flex-col rounded-t-[20px] h-[55vh] mt-24 fixed bottom-0 left-0 right-0 z-50 outline-none text-white max-w-lg mx-auto">
                    <div className="p-4 bg-[#111] rounded-t-[20px] flex-1">
                        <div className="mx-auto w-12 h-1.5 flex-shrink-0 rounded-full bg-gray-600 mb-6" />

                        <div className="grid grid-cols-4 gap-4 mb-6">
                            <button onClick={() => { onToggleSavedReel(); onClose() }} className="flex flex-col items-center gap-2 group">
                                <div className="w-14 h-14 rounded-full bg-gray-800 flex items-center justify-center transition-colors group-hover:bg-gray-700">
                                    <Bookmark className={savedReel ? "fill-white text-white" : "text-white"} size={26} />
                                </div>
                                <span className="text-xs text-center font-medium">Save</span>
                            </button>

                            <button onClick={() => { onToggleSavedAudio(); onClose() }} className="flex flex-col items-center gap-2 group">
                                <div className="w-14 h-14 rounded-full bg-gray-800 flex items-center justify-center transition-colors group-hover:bg-gray-700">
                                    <Music className={savedAudio ? "fill-brand-secondary text-brand-secondary" : "text-white"} size={26} />
                                </div>
                                <span className="text-xs text-center font-medium leading-tight">Save Audio</span>
                            </button>
                        </div>

                        <div className="bg-gray-900 rounded-xl overflow-hidden divide-y divide-gray-800 border border-gray-800">
                            <button
                                onClick={() => handleNotInterested(false)}
                                disabled={isProcessing || !user || user.id === video.users.id}
                                className="w-full flex items-center justify-between p-4 bg-gray-900 hover:bg-white/5 disabled:opacity-50 transition-colors"
                                aria-label="Not interested"
                            >
                                <div className="flex items-center gap-3 text-white font-medium">
                                    <ShieldMinus size={20} className="text-white" />
                                    Not interested
                                </div>
                                {isProcessing && <Loader2 size={16} className="animate-spin text-gray-500" />}
                            </button>

                            <button
                                onClick={handleBlockUser}
                                disabled={isProcessing || !user || user.id === video.users.id}
                                className="w-full flex items-center p-4 bg-gray-900 hover:bg-white/5 disabled:opacity-50 transition-colors text-red-500 font-medium"
                                aria-label="Block User"
                            >
                                <div className="flex items-center gap-3">
                                    <Ban size={20} />
                                    Block {video.users.username}
                                </div>
                            </button>

                            <button
                                onClick={() => setAutoPlayEnabled(!autoPlayEnabled)}
                                className="w-full flex items-center justify-between p-4 bg-gray-900 hover:bg-white/5 transition-colors"
                            >
                                <div className="flex items-center gap-3 text-white font-medium">
                                    <PlayCircle size={20} className="text-white" />
                                    Auto-Advance
                                </div>
                                <div className={`w-11 h-6 rounded-full relative transition-colors ${autoPlayEnabled ? 'bg-brand-accent' : 'bg-gray-700'}`}>
                                    <div className={`w-5 h-5 bg-white rounded-full absolute top-0.5 transition-transform ${autoPlayEnabled ? 'translate-x-[22px]' : 'translate-x-0.5'}`} />
                                </div>
                            </button>
                        </div>
                    </div>
                </Drawer.Content>
            </Drawer.Portal>

            {/* Undo Toast */}
            {toastMessage && (
                <div className="fixed bottom-24 left-1/2 -translate-x-1/2 z-[60] py-3 px-5 bg-[#222] text-white rounded-lg shadow-xl flex items-center gap-4 animate-in slide-in-from-bottom-5">
                    <span className="text-sm font-medium">{toastMessage.message}</span>
                    {toastMessage.undoAction && (
                        <button onClick={toastMessage.undoAction} className="text-brand-accent font-bold text-sm">
                            Undo
                        </button>
                    )}
                </div>
            )}
        </Drawer.Root>
    )
}
