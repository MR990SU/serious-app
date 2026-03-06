'use server'

import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { z } from 'zod'
import { isRateLimited } from '@/lib/rate-limit'

const uuidSchema = z.string().uuid()
const commentContentSchema = z.string().min(1).max(300).trim()

const getSupabase = async () => {
    const cookieStore = await cookies()
    return createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        {
            cookies: {
                getAll() { return cookieStore.getAll() },
                setAll(cookiesToSet) {
                    try {
                        cookiesToSet.forEach(({ name, value, options }) =>
                            cookieStore.set(name, value, options)
                        )
                    } catch { }
                },
            },
        }
    )
}

export async function deleteComment(commentId: string) {
    const parsed = uuidSchema.safeParse(commentId)
    if (!parsed.success) return { success: false, error: 'Invalid comment ID' }

    const supabase = await getSupabase()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { success: false, error: 'Not authenticated' }

    try {
        const { error } = await supabase
            .from('comments')
            .update({ deleted_at: new Date().toISOString() })
            .eq('id', commentId)
            .eq('user_id', user.id)

        if (error) throw error
        return { success: true }
    } catch (error: any) {
        return { success: false, error: error.message }
    }
}

export async function toggleCommentLike(commentId: string) {
    const parsed = uuidSchema.safeParse(commentId)
    if (!parsed.success) return { success: false, error: 'Invalid comment ID' }

    const supabase = await getSupabase()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { success: false, error: 'Not authenticated' }

    // Rate limit: 30 comment likes per minute (same as video likes)
    if (isRateLimited(user.id, 'toggleCommentLike', 30, 60_000)) {
        return { success: false, error: 'Too many requests' }
    }

    try {
        const { data: existingLike } = await supabase
            .from('comment_likes')
            .select('id')
            .eq('comment_id', commentId)
            .eq('user_id', user.id)
            .single()

        if (existingLike) {
            const { error } = await supabase.from('comment_likes').delete().eq('id', existingLike.id)
            if (error) throw error
            return { success: true, liked: false }
        } else {
            const { error } = await supabase.from('comment_likes').insert({
                comment_id: commentId,
                user_id: user.id,
            })
            if (error) throw error
            return { success: true, liked: true }
        }
    } catch (error: any) {
        return { success: false, error: error.message }
    }
}

/**
 * Creates a new comment on a video.
 * Rate limited to 20 per minute per user.
 * Content is validated server-side (1–300 characters).
 */
export async function createComment(videoId: string, content: string, parentId: string | null) {
    const videoIdParsed = uuidSchema.safeParse(videoId)
    if (!videoIdParsed.success) return { success: false, error: 'Invalid video ID' }

    if (parentId !== null) {
        const parentIdParsed = uuidSchema.safeParse(parentId)
        if (!parentIdParsed.success) return { success: false, error: 'Invalid parent ID' }
    }

    const contentParsed = commentContentSchema.safeParse(content)
    if (!contentParsed.success) return { success: false, error: 'Comment must be 1–300 characters' }

    const supabase = await getSupabase()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { success: false, error: 'Not authenticated' }

    // Rate limit: 20 comments per minute
    if (isRateLimited(user.id, 'createComment', 20, 60_000)) {
        return { success: false, error: 'Too many requests — slow down' }
    }

    const { data, error } = await supabase
        .from('comments')
        .insert({
            video_id: videoId,
            user_id: user.id,
            content: contentParsed.data,
            parent_id: parentId,
        })
        .select('id')
        .single()

    if (error) return { success: false, error: error.message }
    return { success: true, commentId: data.id }
}
