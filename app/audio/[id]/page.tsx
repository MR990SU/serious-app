'use client'
import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Audio, Video } from '@/types'
import { useParams, useRouter, useSearchParams } from 'next/navigation'
import { Music, Disc3, ArrowLeft, Bookmark } from 'lucide-react'
import { ProfilePostViewer } from '@/components/profile/ProfilePostViewer'
import { PostCard } from '@/components/feed/PostCard'

const BATCH_SIZE = 12

export default function AudioPage() {
    const [audio, setAudio] = useState<Audio | null>(null)
    const [videos, setVideos] = useState<Video[]>([])
    const [loading, setLoading] = useState(true)
    const [hasMore, setHasMore] = useState(true)
    const [cursor, setCursor] = useState<string | null>(null)
    const [isSaved, setIsSaved] = useState(false)
    const [saveLoading, setSaveLoading] = useState(false)

    const params = useParams()
    const router = useRouter()
    const searchParams = useSearchParams()
    const supabase = createClient()

    const activeVideoId = searchParams.get('v')
    const activeVideoIndex = videos.findIndex(v => v.id === activeVideoId)
    const activeVideo = activeVideoIndex >= 0 ? videos[activeVideoIndex] : null

    const openVideoModal = useCallback((video: Video) => {
        router.push(`?v=${video.id}`, { scroll: false })
    }, [router])

    const closeVideoModal = useCallback(() => {
        router.back()
    }, [router])

    const fetchVideos = async (audioId: string, currentCursor: string | null) => {
        let query = supabase
            .from('videos')
            .select('*, users:profiles(id, username, avatar_url)')
            .eq('audio_id', audioId)
            .is('deleted_at', null)
            .order('created_at', { ascending: false })
            .limit(BATCH_SIZE)

        if (currentCursor) {
            query = query.lt('created_at', currentCursor)
        }

        const { data, error } = await query
        if (error) {
            console.error('Fetch videos error:', error)
            return { data: [], nextCursor: null }
        }

        // Normalize users
        const fetchedVideos = (data || []).map((v: any) => ({
            ...v,
            users: Array.isArray(v.users) ? v.users[0] : v.users
        }))

        const nextCursor = fetchedVideos.length === BATCH_SIZE
            ? fetchedVideos[fetchedVideos.length - 1].created_at
            : null

        return { data: fetchedVideos as Video[], nextCursor }
    }

    useEffect(() => {
        const loadInitialData = async () => {
            const audioId = params.id as string

            // 1. Fetch audio info
            const { data: audioData } = await supabase
                .from('audio')
                .select('*')
                .eq('id', audioId)
                .single()

            if (audioData) setAudio(audioData as Audio)

            // 2. Fetch initial 12 videos
            const { data, nextCursor } = await fetchVideos(audioId, null)

            // 3. Check if user is logged in and if the audio is saved
            const { data: { user } } = await supabase.auth.getUser()
            if (user) {
                const { data: savedRecord } = await supabase
                    .from('saved_audio')
                    .select('id')
                    .eq('audio_id', audioId)
                    .eq('user_id', user.id)
                    .single()

                if (savedRecord) setIsSaved(true)
            }

            setVideos(data)
            setCursor(nextCursor)
            setHasMore(data.length === BATCH_SIZE)
            setLoading(false)
        }

        loadInitialData()
    }, [params.id, fetchVideos, supabase])

    const loadMoreVideos = async () => {
        if (!hasMore || !cursor || !audio) return

        const { data, nextCursor } = await fetchVideos(audio.id, cursor)

        setVideos(prev => [...prev, ...data])
        setCursor(nextCursor)
        setHasMore(data.length === BATCH_SIZE)
    }

    const toggleSave = async () => {
        if (saveLoading || !audio) return
        setSaveLoading(true)

        // Optimistic toggle
        const newSaved = !isSaved
        setIsSaved(newSaved)

        try {
            const res = await fetch('/api/audio/save', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ audio_id: audio.id })
            })
            const result = await res.json()
            if (!result.success) setIsSaved(!newSaved) // revert
        } catch {
            setIsSaved(!newSaved) // revert
        } finally {
            setSaveLoading(false)
        }
    }

    if (loading) return (
        <div className="h-[100dvh] bg-black flex items-center justify-center">
            <div className="animate-spin rounded-full h-8 w-8 border-2 border-brand-accent border-t-transparent" />
        </div>
    )

    if (!audio) return (
        <div className="h-[100dvh] bg-black text-white flex flex-col items-center justify-center gap-4">
            <p>Audio track not found</p>
            <button onClick={() => router.back()} className="px-4 py-2 bg-gray-800 rounded-full text-sm">Go Back</button>
        </div>
    )

    return (
        <div className="h-full bg-black text-white overflow-y-auto">

            {/* Header / Nav */}
            <div className="sticky top-0 bg-black/80 backdrop-blur-md z-40 p-4 flex items-center gap-4">
                <button
                    onClick={() => router.back()}
                    className="p-2 bg-gray-900 rounded-full hover:bg-gray-800 transition-colors"
                >
                    <ArrowLeft size={20} />
                </button>
                <span className="font-bold text-lg">Audio</span>
            </div>

            {/* Audio Details */}
            <div className="max-w-xl mx-auto flex flex-col items-center py-6 px-4">
                <div className="w-32 h-32 rounded-full bg-gradient-to-tr from-gray-800 to-gray-900 border-4 border-gray-800 flex items-center justify-center shadow-2xl mb-6 relative overflow-hidden group">
                    <Disc3 size={48} className="text-gray-600 absolute" />
                    {/* Decorative track rings */}
                    <div className="absolute inset-0 border-[8px] border-black/20 rounded-full m-4 pointer-events-none" />
                    <div className="absolute inset-0 border-[4px] border-black/20 rounded-full m-8 pointer-events-none" />
                    <div className="w-8 h-8 bg-black rounded-full z-10" />
                </div>

                <h1 className="text-2xl font-black text-center">{audio.title}</h1>
                <p className="text-gray-400 mt-1 font-medium">{audio.artist}</p>

                <div className="mt-4 flex items-center justify-center gap-4">
                    <div className="px-4 py-1.5 bg-gray-900 rounded-full flex items-center gap-2">
                        <Music size={14} className="text-brand-accent" />
                        <span className="text-sm font-bold">{audio.used_count.toLocaleString()} posts</span>
                    </div>

                    <button
                        onClick={toggleSave}
                        disabled={saveLoading}
                        className="px-4 py-1.5 bg-gray-900 rounded-full flex items-center gap-2 hover:bg-gray-800 transition-colors"
                    >
                        <Bookmark size={14} className={isSaved ? "text-brand-accent fill-brand-accent" : "text-gray-400"} />
                        <span className="text-sm font-bold">{isSaved ? 'Saved' : 'Save'}</span>
                    </button>
                </div>
            </div>

            {/* Videos Grid */}
            <div className="max-w-xl mx-auto bg-black pb-24 md:pb-4 border-t border-gray-900">
                <div className="p-4 py-3 border-b border-gray-900">
                    <span className="text-sm font-bold text-gray-400 uppercase tracking-wider">Related Videos</span>
                </div>

                <div className="grid grid-cols-3 gap-[1px]">
                    {videos.map((video) => {
                        return (
                            <PostCard
                                key={video.id}
                                video={video}
                                onClick={() => openVideoModal(video)}
                                className="col-span-1 row-span-1 min-h-[150px] md:min-h-[200px]"
                            />
                        )
                    })}
                </div>

                {videos.length === 0 && (
                    <div className="text-center text-gray-500 py-20 bg-black">
                        No videos using this audio yet.
                    </div>
                )}

                {hasMore && videos.length > 0 && (
                    <div className="flex justify-center p-6">
                        <button
                            onClick={loadMoreVideos}
                            className="px-6 py-2 bg-gray-900 hover:bg-gray-800 rounded-full text-sm font-bold transition-colors"
                        >
                            Load More
                        </button>
                    </div>
                )}
            </div>

            {/* Profile Post Viewer */}
            {activeVideo && activeVideoIndex >= 0 && (
                <ProfilePostViewer
                    posts={videos}
                    startIndex={activeVideoIndex}
                    onClose={closeVideoModal}
                />
            )}
        </div>
    )
}
