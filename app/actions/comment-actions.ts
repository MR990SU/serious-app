'use server'

import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { z } from 'zod'

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
