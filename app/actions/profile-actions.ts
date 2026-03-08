'use server'

import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { z } from 'zod'
import { v2 as cloudinary } from 'cloudinary'
import { isRateLimited } from '@/lib/rate-limit'

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

export async function toggleFollow(targetUserId: string) {
    const parsed = uuidSchema.safeParse(targetUserId)
    if (!parsed.success) return { success: false, error: 'Invalid user ID' }

    const supabase = await getSupabase()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { success: false, error: 'Not authenticated' }
    if (user.id === targetUserId) return { success: false, error: 'Cannot follow yourself' }

    // Rate limit: 10 follow toggles per minute
    if (isRateLimited(user.id, 'toggleFollow', 10, 60_000)) {
        return { success: false, error: 'Too many requests' }
    }

    const { data: existingFollow } = await supabase
        .from('followers')
        .select('follower_id')
        .eq('follower_id', user.id)
        .eq('following_id', targetUserId)
        .single()

    if (existingFollow) {
        await supabase.from('followers').delete()
            .eq('follower_id', user.id)
            .eq('following_id', targetUserId)
        return { success: true, isFollowing: false }
    } else {
        await supabase.from('followers').insert({
            follower_id: user.id,
            following_id: targetUserId,
        })
        // Create notification
        await supabase.from('notifications').insert({
            user_id: targetUserId,
            actor_id: user.id,
            type: 'follow',
            message: 'started following you',
        })
        return { success: true, isFollowing: true }
    }
}

export async function updateProfile(avatarUrl: string | null, bio: string | null) {
    const supabase = await getSupabase()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { success: false, error: 'Unauthorized' }

    // Clamp bio length
    const sanitizedBio = bio ? bio.substring(0, 150).trim() : null

    try {
        await supabase
            .from('profiles')
            .update({ avatar_url: avatarUrl, bio: sanitizedBio })
            .eq('id', user.id)
        return { success: true }
    } catch (error: unknown) {
        return { success: false, error: (error as Error).message }
    }
}

/**
 * Deletes a Cloudinary image asset after verifying the caller owns it.
 *
 * Ownership is verified by:
 * 1. Fetching the authenticated user's stored avatar_url from the database
 * 2. Extracting the public_id from the stored URL
 * 3. Comparing against the requested publicId — destroy only if they match
 *
 * This prevents an authenticated user from deleting another user's asset
 * by guessing or brute-forcing public IDs.
 */
export async function deleteCloudinaryImage(publicId: string) {
    // Basic sanity check
    if (!publicId || publicId.length > 200) {
        return { success: false, error: 'Invalid public ID' }
    }

    const supabase = await getSupabase()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { success: false, error: 'Unauthorized' }

    // Fetch the caller's stored avatar URL
    const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('avatar_url')
        .eq('id', user.id)
        .single()

    if (profileError || !profile?.avatar_url) {
        // No avatar stored — nothing to delete
        return { success: false, error: 'No avatar found for this user' }
    }

    // Extract public_id from the stored Cloudinary URL.
    // Cloudinary URLs follow the pattern:
    //   https://res.cloudinary.com/{cloud}/image/upload/{optional_transforms}/v{version}/{public_id}.{ext}
    // We strip everything up to and including the last `/upload/` segment and any
    // leading transform parameters (e.g. `f_auto,q_auto/`), then remove the file extension.
    const extractPublicId = (url: string): string | null => {
        try {
            const uploadIndex = url.indexOf('/upload/')
            if (uploadIndex === -1) return null
            // Everything after /upload/
            let remainder = url.slice(uploadIndex + '/upload/'.length)
            // Skip versioning: v1234567890/
            remainder = remainder.replace(/^v\d+\//, '')
            // Skip any named/unnamed transformations (e.g. "f_auto,q_auto/" or "c_fill,w_400/")
            // Transformations consist of comma-separated key_value pairs; they never contain spaces.
            remainder = remainder.replace(/^([a-z_]+[a-z0-9_,=.]+\/)+/i, '')
            // Strip the file extension
            const dotIndex = remainder.lastIndexOf('.')
            return dotIndex !== -1 ? remainder.slice(0, dotIndex) : remainder
        } catch {
            return null
        }
    }

    const storedPublicId = extractPublicId(profile.avatar_url)

    if (!storedPublicId || storedPublicId !== publicId) {
        console.warn('[deleteCloudinaryImage] Ownership mismatch', {
            requested: publicId,
            stored: storedPublicId,
            userId: user.id,
        })
        return { success: false, error: 'Forbidden: public ID does not match your avatar' }
    }

    try {
        await cloudinary.uploader.destroy(publicId)
        return { success: true }
    } catch (error: unknown) {
        console.error('Failed to delete from Cloudinary:', error)
        return { success: false, error: (error as Error).message }
    }
}
