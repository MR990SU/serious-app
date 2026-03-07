'use client'
import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Heart, UserPlus, TrendingUp } from 'lucide-react'
import Link from 'next/link'
import { getThumbnailUrl } from '@/lib/utils/video-utils'

type NotifRow = {
    id: string
    seen: boolean
    type: string
    created_at: string
    actor: { id: string; username: string; avatar_url: string | null } | null
    video: { id: string; thumbnail_url: string | null; video_url: string } | null
}

export default function NotificationsPage() {
    const [notifications, setNotifications] = useState<NotifRow[]>([])
    const [loading, setLoading] = useState(true)
    const [hasMore, setHasMore] = useState(true)
    const [cursor, setCursor] = useState<string | null>(null)
    const supabase = createClient()

    const fetchNotifications = useCallback(async (currentCursor: string | null = null) => {
        try {
            const url = currentCursor ? `/api/notifications?cursor=${currentCursor}` : `/api/notifications`
            const res = await fetch(url)
            const data = await res.json()

            if (data.notifications) {
                setNotifications(prev => currentCursor ? [...prev, ...data.notifications] : data.notifications)
                setCursor(data.nextCursor)
                setHasMore(!!data.nextCursor)

                // Mark unread as seen in the background
                if (data.notifications.some((n: NotifRow) => !n.seen)) {
                    fetch('/api/notifications/seen', { method: 'PATCH' }).catch(console.error)
                }
            }
        } catch (e) {
            console.error('Failed to fetch notifications', e)
        } finally {
            setLoading(false)
        }
    }, [])

    useEffect(() => {
        let channel: ReturnType<typeof supabase.channel> | null = null

        const init = async () => {
            const { data: { user } } = await supabase.auth.getUser()
            if (!user) {
                setLoading(false)
                return
            }
            await fetchNotifications(null)

            // Realtime listening for new notifications
            channel = supabase
                .channel(`realtime_notifications:${user.id}`)
                .on(
                    'postgres_changes',
                    {
                        event: 'INSERT',
                        schema: 'public',
                        table: 'notifications',
                        filter: `user_id=eq.${user.id}`,
                    },
                    () => {
                        // Optimistically refresh top of feed on background network changes
                        fetchNotifications(null)
                    }
                )
                .subscribe()
        }

        init()

        return () => {
            if (channel) supabase.removeChannel(channel)
        }
    }, [fetchNotifications, supabase])

    const loadMore = () => {
        if (!loading && hasMore && cursor) {
            fetchNotifications(cursor)
        }
    }

    const getIcon = (type: string) => {
        switch (type) {
            case 'like': return <Heart size={20} className="text-pink-500 fill-pink-500" />
            case 'follow': return <UserPlus size={20} className="text-blue-500" />
            case 'trending': return <TrendingUp size={20} className="text-yellow-500" />
            default: return <Heart size={20} className="text-gray-500" />
        }
    }

    return (
        <div className="min-h-screen bg-black text-white pt-safe pb-20 md:pb-0 font-sans">
            <div className="sticky top-0 z-20 bg-black/80 backdrop-blur-md p-4 border-b border-gray-900">
                <h1 className="text-xl font-bold text-center">Notifications</h1>
            </div>

            {loading ? (
                <div className="flex justify-center mt-20">
                    <div className="animate-spin rounded-full h-8 w-8 border-2 border-brand-accent border-t-transparent" />
                </div>
            ) : notifications.length === 0 ? (
                <div className="flex flex-col items-center justify-center mt-32 text-gray-500">
                    <BellIcon size={48} className="mb-4 opacity-50" />
                    <p>No notifications yet</p>
                </div>
            ) : (
                <div className="flex flex-col divide-y divide-gray-900">
                    {notifications.map((notif) => (
                        <div key={notif.id} className={`flex items-center gap-4 p-4 hover:bg-white/5 transition-colors ${!notif.seen ? 'bg-white/5' : ''}`}>

                            <Link href={`/profile/${notif.actor?.username || notif.actor?.id}`} prefetch className="shrink-0 relative">
                                <div className="w-12 h-12 rounded-full overflow-hidden bg-gray-800">
                                    {notif.actor?.avatar_url ? (
                                        <img src={notif.actor.avatar_url} alt="" className="w-full h-full object-cover" />
                                    ) : (
                                        <div className="w-full h-full bg-gradient-to-tr from-brand-secondary to-brand-primary" />
                                    )}
                                </div>
                                <div className="absolute -bottom-1 -right-1 bg-gray-900 rounded-full p-1 border border-black shadow">
                                    {getIcon(notif.type)}
                                </div>
                            </Link>

                            <div className="flex-1 min-w-0">
                                <p className="text-sm">
                                    <Link href={`/profile/${notif.actor?.username || notif.actor?.id}`} prefetch className="font-bold hover:underline">
                                        {notif.actor?.username || 'Someone'}
                                    </Link>{' '}
                                    <span className="text-gray-300">
                                        {notif.type === 'like' ? 'liked your reel' :
                                            notif.type === 'comment' ? 'commented on your reel' :
                                                'interacted with you'}
                                    </span>
                                </p>
                                <p className="text-xs text-gray-500 mt-1">
                                    {new Date(notif.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                                </p>
                            </div>

                            {/* Use thumbnail_url (static image) — NOT a <video> element which downloads the full video */}
                            {notif.type === 'like' && notif.video && (
                                <Link href={`/?v=${notif.video.id}`} className="shrink-0">
                                    <div className="w-12 h-14 rounded overflow-hidden bg-gray-800">
                                        <img
                                            src={notif.video.thumbnail_url || getThumbnailUrl(notif.video.video_url)}
                                            alt="video thumbnail"
                                            className="w-full h-full object-cover"
                                        />
                                    </div>
                                </Link>
                            )}
                        </div>
                    ))}

                    {hasMore && (
                        <div className="flex justify-center p-6 border-t border-gray-900">
                            <button
                                onClick={loadMore}
                                className="px-6 py-2 bg-gray-900 hover:bg-gray-800 rounded-full text-sm font-bold transition-colors"
                            >
                                Load More
                            </button>
                        </div>
                    )}
                </div>
            )}
        </div>
    )
}

function BellIcon({ size, className }: { size: number, className: string }) {
    return <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" /><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" /></svg>
}
