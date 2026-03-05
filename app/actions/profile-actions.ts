'use server'

import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { z } from 'zod'
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
    } catch (error: any) {
        return { success: false, error: error.message }
    }
}

export async function deleteCloudinaryImage(publicId: string) {
    if (!publicId || publicId.length > 200) return { success: false, error: 'Invalid public ID' }
    try {
        await cloudinary.uploader.destroy(publicId)
        return { success: true }
    } catch (error: any) {
        console.error('Failed to delete from Cloudinary:', error)
        return { success: false, error: error.message }
    }
}
