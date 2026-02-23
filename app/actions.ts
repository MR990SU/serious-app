'use server'

import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { v2 as cloudinary } from 'cloudinary'

cloudinary.config({
    cloud_name: process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
})

// Helper to get authenticated server client
const getSupabase = async () => {
    const cookieStore = await cookies()
    return createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        {
            cookies: {
                get(name: string) { return cookieStore.get(name)?.value },
                set(name: string, value: string, options: any) { },
                remove(name: string, options: any) { },
            },
        }
    )
}

export async function incrementViewCount(videoId: string) {
    const supabase = await getSupabase()

    // First get current user if any
    const { data: { user } } = await supabase.auth.getUser()

    // Log the view in the views table
    // The handle_views_count trigger will automatically increment the view_count on the video
    await supabase.from('views').insert({
        video_id: videoId,
        user_id: user?.id || null
    })
}

export async function toggleLike(videoId: string) {
    const supabase = await getSupabase()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) return { success: false, error: 'Not authenticated' }

    // Check if like exists
    const { data: existingLike } = await supabase
        .from('likes')
        .select('*')
        .eq('video_id', videoId)
        .eq('user_id', user.id)
        .single()

    if (existingLike) {
        // Unlike
        // Trigger handle_likes_count will decrement video likes_count automatically
        await supabase.from('likes').delete().eq('id', existingLike.id)

        return { success: true, liked: false }
    } else {
        // Like
        // Trigger handle_likes_count will increment video likes_count automatically
        await supabase.from('likes').insert({
            video_id: videoId,
            user_id: user.id
        })

        return { success: true, liked: true }
    }
}

export async function toggleFollow(targetUserId: string) {
    const supabase = await getSupabase()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) return { success: false, error: 'Not authenticated' }
    if (user.id === targetUserId) return { success: false, error: 'Cannot follow yourself' }

    // Check if follow exists
    const { data: existingFollow } = await supabase
        .from('followers')
        .select('*')
        .eq('follower_id', user.id)
        .eq('following_id', targetUserId)
        .single()

    if (existingFollow) {
        // Unfollow
        await supabase.from('followers').delete()
            .eq('follower_id', user.id)
            .eq('following_id', targetUserId)

        return { success: true, isFollowing: false }
    } else {
        // Follow
        await supabase.from('followers').insert({
            follower_id: user.id,
            following_id: targetUserId
        })

        // Trigger Notification
        await supabase.from('notifications').insert({
            user_id: targetUserId,
            actor_id: user.id,
            type: 'follow',
            message: 'started following you'
        })

        return { success: true, isFollowing: true }
    }
}

export async function updateProfile(avatarUrl: string | null, bio: string | null) {
    const supabase = await getSupabase()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) return { success: false, error: 'Unauthorized' }

    try {
        await supabase
            .from('profiles')
            .update({
                avatar_url: avatarUrl,
                bio: bio
            })
            .eq('id', user.id)

        return { success: true }
    } catch (error: any) {
        return { success: false, error: error.message }
    }
}

export async function deleteCloudinaryImage(publicId: string) {
    // Only allow secure server-side execution
    try {
        await cloudinary.uploader.destroy(publicId)
        return { success: true }
    } catch (error: any) {
        console.error('Failed to delete from Cloudinary:', error)
        return { success: false, error: error.message }
    }
}

export async function deleteComment(commentId: string) {
    const supabase = await getSupabase()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) return { success: false, error: 'Not authenticated' }

    try {
        // Soft delete by setting deleted_at
        // Due to RLS, this will only succeed if auth.uid() = user_id (the owner)
        const { error } = await supabase
            .from('comments')
            .update({ deleted_at: new Date().toISOString() })
            .eq('id', commentId)
            .eq('user_id', user.id) // Extra safety check

        if (error) throw error
        return { success: true }
    } catch (error: any) {
        return { success: false, error: error.message }
    }
}

export async function toggleCommentLike(commentId: string) {
    const supabase = await getSupabase()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) return { success: false, error: 'Not authenticated' }

    try {
        // Check if like exists
        const { data: existingLike } = await supabase
            .from('comment_likes')
            .select('id')
            .eq('comment_id', commentId)
            .eq('user_id', user.id)
            .single()

        if (existingLike) {
            // Unlike
            const { error } = await supabase.from('comment_likes').delete().eq('id', existingLike.id)
            if (error) throw error
            return { success: true, liked: false }
        } else {
            // Like
            const { error } = await supabase.from('comment_likes').insert({
                comment_id: commentId,
                user_id: user.id
            })
            if (error) throw error
            return { success: true, liked: true }
        }
    } catch (error: any) {
        return { success: false, error: error.message }
    }
}
