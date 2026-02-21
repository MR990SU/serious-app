'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Comment } from '@/types'

// Note: Since we are in the layout, we don't naturally know which video is active in view.
// In a full implementation, you'd use a global store (Zustand/Context) to track the 'activeVideoId'
// For this demo structure, we will fetch the most recent comments globally.

export function CommentsSection() {
    const [comments, setComments] = useState<Comment[]>([])
    const [loading, setLoading] = useState(true)
    const [newComment, setNewComment] = useState('')
    const supabase = createClient()

    useEffect(() => {
        fetchComments()

        const channel = supabase
            .channel('realtime:comments')
            .on(
                'postgres_changes',
                {
                    event: 'INSERT',
                    schema: 'public',
                    table: 'comments'
                },
                () => {
                    fetchComments()
                }
            )
            .subscribe()

        return () => {
            supabase.removeChannel(channel)
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])

    const fetchComments = async () => {
        const { data, error } = await supabase
            .from('comments')
            .select('*, users(id, username, avatar_url)')
            .order('created_at', { ascending: false })
            .limit(10)

        if (error) console.error(error)
        if (data) setComments(data as Comment[])
        setLoading(false)
    }

    const handlePost = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!newComment.trim()) return

        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return alert('Must be logged in to comment')

        // For demo, we are posting a global comment without a specific video_id context from the layout
        // Assuming video_id is required, we would fetch the first video to attach it to,
        // or rely on a global state. We'll simulate error handling here.

        // Attempt logic: Find a recent video to attach to if activeVideoId isn't global
        const { data: videos } = await supabase.from('videos').select('id').limit(1)
        if (!videos || videos.length === 0) return

        const { error } = await supabase
            .from('comments')
            .insert({
                video_id: videos[0].id,
                user_id: user.id,
                content: newComment.trim()
            })

        if (!error) {
            setNewComment('')
            fetchComments()
        }
    }

    return (
        <section className="flex flex-col h-full overflow-hidden">
            <h3 className="font-bold text-gray-400 mb-4 px-2 shrink-0">Recent Comments</h3>

            <div className="flex-1 overflow-y-auto no-scrollbar flex flex-col gap-4 pb-4">
                {loading ? (
                    <div className="text-gray-500 text-xs px-2 animate-pulse">Loading...</div>
                ) : comments.length === 0 ? (
                    <div className="text-gray-500 text-xs px-2">No comments yet.</div>
                ) : (
                    comments.map(c => (
                        <div key={c.id} className="flex gap-3 px-2">
                            <div className="w-8 h-8 rounded-full bg-gray-700 overflow-hidden shrink-0 mt-1">
                                {c.users?.avatar_url ? (
                                    <img src={c.users.avatar_url} alt="" className="w-full h-full object-cover" />
                                ) : (
                                    <div className="w-full h-full bg-gradient-to-tr from-brand-secondary to-brand-primary" />
                                )}
                            </div>
                            <div className="flex flex-col">
                                <span className="font-bold border-gray-400 text-xs text-white/70">@{c.users?.username || 'user'}</span>
                                <p className="text-sm mt-0.5">{c.content}</p>
                            </div>
                        </div>
                    ))
                )}
            </div>

            <form onSubmit={handlePost} className="shrink-0 mt-4 px-2">
                <div className="relative">
                    <input
                        type="text"
                        placeholder="Add comment..."
                        className="w-full bg-white/10 border border-white/20 rounded-full py-2 px-4 text-sm focus:outline-none focus:border-brand-primary transition-colors pr-12"
                        value={newComment}
                        onChange={(e) => setNewComment(e.target.value)}
                    />
                    <button
                        type="submit"
                        disabled={!newComment.trim()}
                        className="absolute right-2 top-1/2 -translate-y-1/2 text-brand-secondary font-bold text-sm disabled:opacity-50"
                    >
                        Post
                    </button>
                </div>
            </form>
        </section>
    )
}
