'use client'
import { useState, useEffect, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'
import Image from 'next/image'
import { Search } from 'lucide-react'
import { Video } from '@/types'
import { getThumbnailUrl } from '@/lib/utils/video-utils'
import { PostCard } from '@/components/feed/PostCard'
import { useRouter } from 'next/navigation'

export default function DiscoverPage() {
    const [query, setQuery] = useState('')
    const [results, setResults] = useState<Video[]>([])
    const [loading, setLoading] = useState(false)
    const seenIds = useRef(new Set<string>())
    const supabase = createClient()
    const router = useRouter()

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
        try {
            const res = await fetch('/api/explore')
            const data = await res.json()
            if (data.videos) {
                // Client-side deduplication using a Set
                const newVideos = data.videos.filter((v: Video) => !seenIds.current.has(v.id))
                newVideos.forEach((v: Video) => seenIds.current.add(v.id))

                // If it's the initial load, just set them. If fetching more (future), append.
                setResults(prev => prev.length === 0 ? newVideos : [...prev, ...newVideos])
            }
        } catch (error) {
            console.error('Failed to fetch explore feed:', error)
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
                            <PostCard
                                key={video.id}
                                video={video}
                                onClick={() => router.push(`/?v=${video.id}`)}
                                className={idx % 7 === 0 ? 'col-span-2 row-span-2' : 'col-span-1 row-span-1 min-h-[150px] md:min-h-[200px]'}
                            />
                        ))}
                    </div>
                )}
            </div>
        </div>
    )
}
