'use client'
import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'
import Image from 'next/image'
import { Search } from 'lucide-react'
import { Video } from '@/types'
import { getThumbnailUrl } from '@/lib/utils/video-utils'

export default function DiscoverPage() {
    const [query, setQuery] = useState('')
    const [results, setResults] = useState<Video[]>([])
    const [loading, setLoading] = useState(false)
    const supabase = createClient()

    // Debounce search
    useEffect(() => {
        const delayDebounceFn = setTimeout(async () => {
            if (query) {
                setLoading(true)
                // Basic full text search across caption, or related users
                const { data, error } = await supabase
                    .from('videos')
                    .select('*, users:profiles!inner(id, username, full_name, avatar_url)')
                    .is('deleted_at', null)
                    .or(`caption.ilike.%${query}%,users.username.ilike.%${query}%`)
                    .limit(20)

                if (!error && data) {
                    // format the users array if it returns as array (rpc/postgREST joins sometimes do)
                    const formattedData = data.map((v: any) => ({
                        ...v,
                        users: Array.isArray(v.users) ? v.users[0] : v.users
                    })) as unknown as Video[]
                    setResults(formattedData)
                }
                setLoading(false)
            } else {
                // If empty, fetch random popular reels
                fetchPopular()
            }
        }, 500)

        return () => clearTimeout(delayDebounceFn)
    }, [query])

    const fetchPopular = async () => {
        setLoading(true)
        const { data } = await supabase
            .from('trending_videos')
            .select('*, users:profiles(id, username, avatar_url, full_name)')
            .is('deleted_at', null)
            .limit(20)

        if (data) {
            const formattedData = data.map((v: any) => ({
                ...v,
                id: v.video_id, // Map the materialized view's video_id back to standard 'id' for the frontend
                users: Array.isArray(v.users) ? v.users[0] : v.users
            })) as unknown as Video[]
            setResults(formattedData)
        }
        setLoading(false)
    }

    // Load popular automatically on mount
    useEffect(() => {
        fetchPopular()
    }, [])

    return (
        <div className="h-full w-full bg-black flex flex-col pt-safe overflow-hidden pb-16 md:pb-0">
            {/* Sticky Header with Search Bar */}
            <div className="sticky top-0 z-20 bg-black/80 backdrop-blur-xl border-b border-white/10 p-4">
                <div className="relative max-w-2xl mx-auto">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" size={20} />
                    <input
                        type="text"
                        placeholder="Search accounts or suggested videos"
                        className="w-full bg-gray-900 text-white placeholder-gray-500 rounded-xl py-3 pl-10 pr-4 outline-none focus:ring-2 focus:ring-pink-500/50 transition-all border border-gray-800"
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                    />
                </div>
            </div>

            {/* Masonry Grid Feed */}
            <div className="flex-1 overflow-y-auto w-full p-1 space-y-1">
                {loading && results.length === 0 ? (
                    <div className="flex justify-center p-10">
                        <div className="animate-spin rounded-full h-8 w-8 border-2 border-pink-500 border-t-transparent" />
                    </div>
                ) : (
                    <div className="grid grid-cols-3 gap-1 grid-flow-row-dense">
                        {results.map((video, idx) => (
                            <Link
                                href={`/?v=${video.id}`}
                                key={video.id}
                                className={`relative group bg-gray-900 overflow-hidden ${idx % 7 === 0 ? 'col-span-2 row-span-2' : 'col-span-1 row-span-1 min-h-[150px] md:min-h-[200px]'
                                    }`}
                            >
                                {/* Static thumbnail (next/image for LCP optimization) */}
                                <Image
                                    src={getThumbnailUrl(video.video_url)}
                                    alt={video.caption || 'Video thumbnail'}
                                    fill
                                    sizes="(max-width: 640px) 33vw, 200px"
                                    className="object-cover group-hover:scale-105 transition-transform duration-500"
                                />
                                <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex items-end p-2">
                                    <span className="text-white text-xs font-semibold drop-shadow-md">
                                        @{video.users?.username}
                                    </span>
                                </div>
                            </Link>
                        ))}
                    </div>
                )}
            </div>
        </div>
    )
}
