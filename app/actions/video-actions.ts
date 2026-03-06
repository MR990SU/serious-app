'use server'

import { createServerClient } from '@supabase/ssr'
import { cookies, headers } from 'next/headers'
import { z } from 'zod'
import { isRateLimited } from '@/lib/rate-limit'
import { createHash } from 'crypto'

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

    const identifier = user?.id ?? null

    // Rate limit: 10 view counts per minute per user/IP
    const rateLimitKey = identifier ?? 'anon'
    if (isRateLimited(rateLimitKey, 'incrementViewCount', 10, 60_000)) return

    if (identifier) {
        // Authenticated: deduplicate by (video_id, user_id, date)
        await supabase.from('views').upsert(
            { video_id: videoId, user_id: identifier },
            { onConflict: 'video_id,user_id,view_date', ignoreDuplicates: true }
        )
    } else {
        // Anonymous: deduplicate by hashed IP + date
        const headerStore = await headers()
        const ip =
            headerStore.get('x-forwarded-for')?.split(',')[0].trim() ??
            headerStore.get('x-real-ip') ??
            'unknown'
        const today = new Date().toISOString().slice(0, 10) // YYYY-MM-DD
        const anonIdentifier = createHash('sha256')
            .update(`${ip}:${videoId}:${today}`)
            .digest('hex')

        await supabase.from('views').upsert(
            { video_id: videoId, user_id: null, anon_identifier: anonIdentifier },
            { onConflict: 'video_id,anon_identifier,view_date', ignoreDuplicates: true }
        )
    }
}

export async function toggleLike(videoId: string) {
    const parsed = uuidSchema.safeParse(videoId)
    if (!parsed.success) return { success: false, error: 'Invalid video ID' }

    const supabase = await getSupabase()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { success: false, error: 'Not authenticated' }

    // Rate limit: 30 like toggles per minute
    if (isRateLimited(user.id, 'toggleLike', 30, 60_000)) {
        return { success: false, error: 'Too many requests' }
    }

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
