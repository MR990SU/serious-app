'use client'

import { useState, useEffect, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Comment } from '@/types'
import { useVideoStore } from '@/lib/store/useVideoStore'
import { deleteComment, toggleCommentLike } from '@/app/actions/comment-actions'
import { Heart, Trash2, Reply } from 'lucide-react'
import { ClickableAvatar } from '@/components/profile/ClickableAvatar'
import Link from 'next/link'

export function CommentsSection() {
    const { activeVideoId, incrementCommentCount, setCommentCount, decrementLikeCount } = useVideoStore()
    const [comments, setComments] = useState<Comment[]>([])
    const [loading, setLoading] = useState(false)
    const [newComment, setNewComment] = useState('')
    const [replyingTo, setReplyingTo] = useState<{ id: string, username: string, parentId: string | null } | null>(null)
    const [currentUserId, setCurrentUserId] = useState<string | null>(null)
    const [localLikes, setLocalLikes] = useState<{ [key: string]: boolean }>({})
    const inputRef = useRef<HTMLInputElement>(null)
    const supabase = createClient()

    useEffect(() => {
        if (!activeVideoId) {
            setComments([])
            return
        }

        const fetchCommentsAndUser = async () => {
            const { data: { user } } = await supabase.auth.getUser()
            if (user) setCurrentUserId(user.id)

            setLoading(true)
            const { data, count, error } = await supabase
                .from('comments')
                .select('*, users:profiles(id, username, avatar_url)', { count: 'exact' })
                .eq('video_id', activeVideoId)
                .is('deleted_at', null)
                .order('created_at', { ascending: false })
                .limit(50)

            if (!error && data) {
                setComments(data as Comment[])
                if (count !== null) setCommentCount(count)

                if (user) {
                    const commentIds = data.map(c => c.id)
                    if (commentIds.length > 0) {
                        const { data: likesData } = await supabase
                            .from('comment_likes')
                            .select('comment_id')
                            .in('comment_id', commentIds)
                            .eq('user_id', user.id)

                        if (likesData) {
                            const likesMap: { [key: string]: boolean } = {}
                            likesData.forEach(l => likesMap[l.comment_id] = true)
                            setLocalLikes(likesMap)
                        }
                    }
                }
            }
            setLoading(false)
        }

        fetchCommentsAndUser()

        // Realtime: append new comments instead of full refetch (avoids N+1)
        const channel = supabase
            .channel(`realtime:comments:${activeVideoId}`)
            .on(
                'postgres_changes',
                {
                    event: 'INSERT',
                    schema: 'public',
                    table: 'comments',
                    filter: `video_id=eq.${activeVideoId}`,
                },
                async (payload) => {
                    // Fetch the new comment with joined user data
                    const { data: newComment } = await supabase
                        .from('comments')
                        .select('*, users:profiles(id, username, avatar_url)')
                        .eq('id', payload.new.id)
                        .single()

                    if (newComment) {
                        setComments(prev => [newComment as Comment, ...prev])
                        incrementCommentCount()
                    }
                }
            )
            .subscribe()

        return () => {
            supabase.removeChannel(channel)
        }
    }, [activeVideoId])

    const handlePost = async (e: React.FormEvent) => {
        e.preventDefault()
        const content = newComment.trim()
        if (!content || !activeVideoId) return

        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return alert('Must be logged in to comment')

        const parentId = replyingTo?.parentId || replyingTo?.id || null

        // Optimistic insert — add a temporary comment immediately
        const tempId = `temp-${Date.now()}`
        const optimisticComment: Comment = {
            id: tempId,
            video_id: activeVideoId,
            user_id: user.id,
            content,
            parent_id: parentId,
            likes_count: 0,
            reply_count: 0,
            created_at: new Date().toISOString(),
            deleted_at: null,
            users: {
                id: user.id,
                username: 'You',
                avatar_url: null,
                bio: null,
            },
        }
        setComments(prev => [optimisticComment, ...prev])
        setNewComment('')
        setReplyingTo(null)
        incrementCommentCount()

        // Actual DB insert
        const { error } = await supabase
            .from('comments')
            .insert({
                video_id: activeVideoId,
                user_id: user.id,
                content,
                parent_id: parentId,
            })

        if (error) {
            // Revert optimistic update on failure
            setComments(prev => prev.filter(c => c.id !== tempId))
            setNewComment(content)  // restore what they typed
            console.error('[CommentsSection] Insert failed:', error.message)
        }
        // On success: realtime subscription will push the real row which de-duplicates the temp entry
    }

    const handleDelete = async (commentId: string) => {
        if (!confirm('Are you sure you want to delete this comment?')) return

        // Optimistic UI Removal
        setComments(prev => prev.filter(c => c.id !== commentId && c.parent_id !== commentId))
        await deleteComment(commentId)
    }

    const handleLike = async (commentId: string, currentLikes: number) => {
        const isLiked = localLikes[commentId]

        // Optimistic UI
        setLocalLikes(prev => ({ ...prev, [commentId]: !isLiked }))
        setComments(prev => prev.map(c => {
            if (c.id === commentId) {
                return { ...c, likes_count: isLiked ? c.likes_count - 1 : c.likes_count + 1 }
            }
            return c
        }))

        const result = await toggleCommentLike(commentId)
        if (result && !result.success) {
            // Revert
            setLocalLikes(prev => ({ ...prev, [commentId]: isLiked }))
            setComments(prev => prev.map(c => {
                if (c.id === commentId) {
                    return { ...c, likes_count: currentLikes }
                }
                return c
            }))
        }
    }

    // Group comments logically: Parents first, then their direct children beneath them
    const topLevelComments = comments.filter(c => !c.parent_id)
    const replies = comments.filter(c => c.parent_id)

    const groupedComments = topLevelComments.flatMap(parent => {
        const children = replies.filter(r => r.parent_id === parent.id).reverse() // Older replies first if desired
        return [parent, ...children]
    })

    return (
        <section className="flex flex-col h-full overflow-hidden text-sm">
            <h3 className="font-bold text-gray-400 mb-4 px-2 shrink-0">
                {activeVideoId ? 'Comments' : 'Scroll to view comments'}
            </h3>

            <div className="flex-1 overflow-y-auto no-scrollbar flex flex-col gap-4 pb-4">
                {!activeVideoId ? (
                    <div className="text-gray-500 text-xs px-2 opacity-50 text-center mt-10">Waiting for video...</div>
                ) : loading ? (
                    <div className="text-gray-500 text-xs px-2 animate-pulse">Loading...</div>
                ) : groupedComments.length === 0 ? (
                    <div className="text-gray-500 text-xs px-2">Be the first to comment.</div>
                ) : (
                    groupedComments.map(c => {
                        const isReply = !!c.parent_id;
                        const isOwner = c.user_id === currentUserId;
                        const isLiked = localLikes[c.id];

                        return (
                            <div key={c.id} className={`flex flex-col gap-1 px-2 ${isReply ? 'ml-10 mt-1 relative' : 'mt-2'}`}>
                                {isReply && (
                                    <div className="absolute -left-6 top-0 bottom-4 w-4 border-l-2 border-b-2 border-white/10 rounded-bl-xl" />
                                )}
                                <div className="flex gap-3">
                                    <div className={`rounded-full bg-gray-700 overflow-hidden shrink-0 mt-1 ${isReply ? 'w-6 h-6' : 'w-8 h-8'}`}>
                                        <ClickableAvatar
                                            src={c.users?.avatar_url || null}
                                            username={c.users?.username}
                                            className="w-full h-full"
                                        />
                                    </div>
                                    <div className="flex flex-col flex-1">
                                        <Link href={`/profile/${c.users?.id || 'me'}`} prefetch className="font-bold border-gray-400 text-xs text-white/70 hover:underline">
                                            @{c.users?.username || 'user'}
                                        </Link>
                                        <p className="text-sm mt-0.5 break-words text-white/90 leading-tight">
                                            {c.content}
                                        </p>

                                        {/* Interaction Buttons */}
                                        <div className="flex items-center gap-4 mt-2 text-xs text-white/50 font-semibold">
                                            <button
                                                onClick={() => handleLike(c.id, c.likes_count)}
                                                className={`flex items-center gap-1 hover:text-brand-accent transition-colors ${isLiked ? 'text-brand-accent' : ''}`}
                                            >
                                                <Heart size={12} fill={isLiked ? "currentColor" : "none"} />
                                                <span>{c.likes_count > 0 ? c.likes_count : 'Like'}</span>
                                            </button>

                                            <button
                                                onClick={() => {
                                                    setReplyingTo({ id: c.id, username: c.users?.username || 'user', parentId: c.parent_id || null })
                                                    inputRef.current?.focus()
                                                }}
                                                className="flex items-center gap-1 hover:text-white transition-colors"
                                            >
                                                <Reply size={12} />
                                                <span>Reply</span>
                                            </button>

                                            {isOwner && (
                                                <button
                                                    onClick={() => handleDelete(c.id)}
                                                    className="flex items-center gap-1 hover:text-red-500 transition-colors ml-auto"
                                                >
                                                    <Trash2 size={12} />
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )
                    })
                )}
            </div>

            <form onSubmit={handlePost} className="shrink-0 mt-4 px-2">
                {replyingTo && (
                    <div className="flex items-center justify-between bg-white/5 px-3 py-1.5 rounded-t-lg text-xs text-white/70 border-b border-white/10">
                        <span>Replying to <span className="font-bold text-brand-secondary">@{replyingTo.username}</span></span>
                        <button type="button" onClick={() => setReplyingTo(null)} className="hover:text-white">Cancel</button>
                    </div>
                )}
                <div className="relative">
                    <input
                        ref={inputRef}
                        type="text"
                        disabled={!activeVideoId}
                        placeholder={activeVideoId ? 'Add comment...' : 'No video active'}
                        className={`w-full bg-white/10 border border-white/20 py-2 px-4 text-sm focus:outline-none focus:border-brand-primary transition-colors pr-16 disabled:opacity-50 ${replyingTo ? 'rounded-b-lg' : 'rounded-full'
                            }`}
                        value={newComment}
                        onChange={(e) => setNewComment(e.target.value.slice(0, 300))}
                        maxLength={300}
                    />
                    <div className="absolute right-10 top-1/2 -translate-y-1/2 text-[10px] text-white/30">
                        {newComment.length > 0 && `${newComment.length}/300`}
                    </div>
                    <button
                        type="submit"
                        disabled={!newComment.trim() || !activeVideoId}
                        className="absolute right-2 top-1/2 -translate-y-1/2 text-brand-secondary font-bold text-sm disabled:opacity-50 p-2"
                    >
                        Post
                    </button>
                </div>
            </form>
        </section>
    )
}
