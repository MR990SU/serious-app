'use server'

import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { z } from 'zod'
import { isRateLimited } from '@/lib/rate-limit'
import { v2 as cloudinary } from 'cloudinary'

cloudinary.config({
    cloud_name: process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME,
    api_key: process.env.NEXT_PUBLIC_CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
})

const uuidSchema = z.string().uuid()

const getSupabase = async () => {
    const cookieStore = await cookies()
    return createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        {
            cookies: {
                getAll() { return cookieStore.getAll() },
                setAll(cookiesToSet) {
                    try { cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options)) }
                    catch { }
                },
            },
        }
    )
}

// ── Toggle bookmark ──────────────────────────────────────────────────────────
export async function toggleBookmark(videoId: string) {
    const parsed = uuidSchema.safeParse(videoId)
    if (!parsed.success) return { success: false, error: 'Invalid video ID' }

    const supabase = await getSupabase()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { success: false, error: 'Not authenticated' }

    if (isRateLimited(user.id, 'toggleBookmark', 20, 60_000)) {
        return { success: false, error: 'Too many requests' }
    }

    const { data: existing } = await supabase
        .from('bookmarks')
        .select('id')
        .eq('user_id', user.id)
        .eq('video_id', videoId)
        .single()

    if (existing) {
        const { error } = await supabase.from('bookmarks').delete().eq('id', existing.id)
        return { success: !error, bookmarked: false, error: error?.message }
    } else {
        const { error } = await supabase
            .from('bookmarks')
            .insert({ user_id: user.id, video_id: videoId })
        return { success: !error, bookmarked: true, error: error?.message }
    }
}

// ── Toggle comments enabled (owner only) ────────────────────────────────────
export async function toggleCommentsEnabled(videoId: string) {
    const parsed = uuidSchema.safeParse(videoId)
    if (!parsed.success) return { success: false, error: 'Invalid video ID' }

    const supabase = await getSupabase()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { success: false, error: 'Not authenticated' }

    if (isRateLimited(user.id, 'toggleCommentsEnabled', 10, 60_000)) {
        return { success: false, error: 'Too many requests' }
    }

    // Fetch video to verify ownership and get current state
    const { data: video, error: fetchErr } = await supabase
        .from('videos')
        .select('user_id, comments_enabled')
        .eq('id', videoId)
        .single()

    if (fetchErr || !video) return { success: false, error: 'Video not found' }
    if (video.user_id !== user.id) return { success: false, error: 'Forbidden: you do not own this video' }

    const newEnabled = !video.comments_enabled
    const { error } = await supabase
        .from('videos')
        .update({ comments_enabled: newEnabled })
        .eq('id', videoId)

    return { success: !error, comments_enabled: newEnabled, error: error?.message }
}

// ── Soft-delete video (owner only) ──────────────────────────────────────────
export async function deleteVideo(videoId: string) {
    const parsed = uuidSchema.safeParse(videoId)
    if (!parsed.success) return { success: false, error: 'Invalid video ID' }

    const supabase = await getSupabase()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { success: false, error: 'Not authenticated' }

    if (isRateLimited(user.id, 'deleteVideo', 5, 60_000)) {
        return { success: false, error: 'Too many requests' }
    }

    // Fetch video to verify ownership and get Cloudinary URL for cleanup
    const { data: video, error: fetchErr } = await supabase
        .from('videos')
        .select('user_id, video_url, thumbnail_url')
        .eq('id', videoId)
        .single()

    if (fetchErr || !video) return { success: false, error: 'Video not found' }
    if (video.user_id !== user.id) return { success: false, error: 'Forbidden: you do not own this video' }

    // Soft-delete first (always succeeds independent of Cloudinary)
    const { error: deleteErr } = await supabase
        .from('videos')
        .update({ deleted_at: new Date().toISOString() })
        .eq('id', videoId)

    if (deleteErr) return { success: false, error: deleteErr.message }

    // Best-effort Cloudinary cleanup (don't block on failure)
    try {
        const extractPublicId = (url: string): string | null => {
            const uploadIndex = url.indexOf('/upload/')
            if (uploadIndex === -1) return null
            let remainder = url.slice(uploadIndex + '/upload/'.length)
            remainder = remainder.replace(/^v\d+\//, '')
            remainder = remainder.replace(/^([a-z_]+[a-z0-9_,=.]+\/)+/i, '')
            const dotIndex = remainder.lastIndexOf('.')
            return dotIndex !== -1 ? remainder.slice(0, dotIndex) : remainder
        }

        const publicId = extractPublicId(video.video_url)
        if (publicId) {
            await cloudinary.uploader.destroy(publicId, { resource_type: 'video' })
        }
    } catch (e) {
        // Log but don't fail — video is already soft-deleted from DB
        console.warn('[deleteVideo] Cloudinary cleanup failed (non-critical):', e)
    }

    return { success: true }
}
