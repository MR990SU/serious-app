'use client'
import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Notification } from '@/types'
import { Heart, UserPlus, TrendingUp } from 'lucide-react'
import Link from 'next/link'

export default function NotificationsPage() {
    const [notifications, setNotifications] = useState<any[]>([])
    const [loading, setLoading] = useState(true)
    const supabase = createClient()

    useEffect(() => {
        fetchNotifications()

        // Realtime subscription for new notifications
        const channel = supabase.channel('realtime_notifications')
            .on(
                'postgres_changes',
                { event: 'INSERT', schema: 'public', table: 'notifications' },
                (payload) => {
                    // Add new notification to the top of the list if we know it's for this user
                    fetchNotifications() // Simplest way to get joined actor data for the new row
                }
            )
            .subscribe()

        return () => {
            supabase.removeChannel(channel)
        }
    }, [])

    const fetchNotifications = async () => {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return

        const { data, error } = await supabase
            .from('notifications')
            .select('*, actor:profiles!actor_id(id, username, avatar_url), video:videos!video_id(id, thumbnail_url, video_url)')
            .eq('user_id', user.id)
            .order('created_at', { ascending: false })
            .limit(30)

        if (data) {
            // Supabase sometimes arrays joined data, check and map.
            const mapped = data.map(n => ({
                ...n,
                actor: Array.isArray(n.actor) ? n.actor[0] : n.actor,
                video: Array.isArray(n.video) ? n.video[0] : n.video,
            }))
            setNotifications(mapped)

            // Mark them all as read once fetched
            const unreadIds = mapped.filter(n => !n.is_read).map(n => n.id)
            if (unreadIds.length > 0) {
                await supabase.from('notifications').update({ is_read: true }).in('id', unreadIds)
            }
        }
        setLoading(false)
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
                        <div key={notif.id} className={`flex items-center gap-4 p-4 hover:bg-white/5 transition-colors ${!notif.is_read ? 'bg-white/5' : ''}`}>

                            <Link href={`/profile/${notif.actor?.id}`} className="shrink-0 relative">
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
                                    <Link href={`/profile/${notif.actor?.id}`} className="font-bold hover:underline">
                                        {notif.actor?.username || 'Someone'}
                                    </Link>{' '}
                                    <span className="text-gray-300">{notif.message}</span>
                                </p>
                                <p className="text-xs text-gray-500 mt-1">
                                    {new Date(notif.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                                </p>
                            </div>

                            {notif.type === 'like' && notif.video && (
                                <Link href={`/?v=${notif.video.id}`} className="shrink-0">
                                    <div className="w-12 h-14 rounded overflow-hidden bg-gray-800">
                                        {notif.video.thumbnail_url || notif.video.video_url ? (
                                            <video src={notif.video.video_url} className="w-full h-full object-cover" muted playsInline />
                                        ) : null}
                                    </div>
                                </Link>
                            )}
                        </div>
                    ))}
                </div>
            )}
        </div>
    )
}

function BellIcon({ size, className }: { size: number, className: string }) {
    return <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" /><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" /></svg>
}
