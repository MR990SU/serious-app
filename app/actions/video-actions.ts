'use server'

import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { z } from 'zod'

const uuidSchema = z.string().uuid()

// Shared helper — functional cookie handlers for session refresh
const getSupabase = async () => {
    const cookieStore = await cookies()
    return createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        {
            cookies: {
                getAll() {
                    return cookieStore.getAll()
                },
                setAll(cookiesToSet) {
                    try {
                        cookiesToSet.forEach(({ name, value, options }) =>
                            cookieStore.set(name, value, options)
                        )
                    } catch {
                        // Ignore if called from a Server Component
                    }
                },
            },
        }
    )
}

export async function incrementViewCount(videoId: string) {
    const parsed = uuidSchema.safeParse(videoId)
    if (!parsed.success) return

    const supabase = await getSupabase()
    const { data: { user } } = await supabase.auth.getUser()

    await supabase.from('views').insert({
        video_id: videoId,
        user_id: user?.id || null,
    })
}

export async function toggleLike(videoId: string) {
    const parsed = uuidSchema.safeParse(videoId)
    if (!parsed.success) return { success: false, error: 'Invalid video ID' }

    const supabase = await getSupabase()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { success: false, error: 'Not authenticated' }

    // Check if already liked
    const { data: existingLike } = await supabase
        .from('likes')
        .select('id')
        .eq('video_id', videoId)
        .eq('user_id', user.id)
        .single()

    if (existingLike) {
        // Unlike — DB trigger automatically decrements videos.likes_count
        const { error } = await supabase
            .from('likes')
            .delete()
            .eq('id', existingLike.id)
        return { success: !error, liked: false, error: error?.message }
    } else {
        // Like — DB trigger automatically increments videos.likes_count
        const { error } = await supabase
            .from('likes')
            .insert({ video_id: videoId, user_id: user.id })
        return { success: !error, liked: true, error: error?.message }
    }
}

