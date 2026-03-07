import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextRequest, NextResponse } from 'next/server'

const NOTIFICATIONS_LIMIT = 15

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

export async function GET(request: NextRequest) {
    const { searchParams } = request.nextUrl
    const cursor = searchParams.get('cursor')       // ISO timestamp

    const supabase = await getSupabase()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
        return NextResponse.json({ notifications: [], nextCursor: null }, { status: 401 })
    }

    let query = supabase
        .from('notifications')
        .select(`
            *,
            actor:profiles!notifications_actor_id_fkey(username, avatar_url),
            video:videos!notifications_video_id_fkey(thumbnail_url, video_url)
        `)
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(NOTIFICATIONS_LIMIT)

    if (cursor) {
        query = query.lt('created_at', cursor)
    }

    const { data, error } = await query

    if (error) {
        console.error('[/api/notifications] Query error:', error.message)
        return NextResponse.json({ notifications: [], nextCursor: null }, { status: 500 })
    }

    // Normalize structures
    const notifications = (data ?? []).map((n: any) => ({
        ...n,
        actor: Array.isArray(n.actor) ? n.actor[0] : n.actor,
        video: Array.isArray(n.video) ? n.video[0] : n.video
    }))

    const nextCursor = data.length === NOTIFICATIONS_LIMIT
        ? notifications[notifications.length - 1].created_at
        : null

    return NextResponse.json({ notifications, nextCursor })
}

export async function PATCH() {
    const supabase = await getSupabase()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
        return NextResponse.json({ success: false, error: 'Not authenticated' }, { status: 401 })
    }

    try {
        const { error } = await supabase
            .from('notifications')
            .update({ seen: true })
            .eq('user_id', user.id)
            .eq('seen', false) // Only touch unseen records to prevent wasted writes

        if (error) throw error

        return NextResponse.json({ success: true })
    } catch (e: any) {
        console.error('[/api/notifications/seen] Error:', e.message)
        return NextResponse.json({ success: false, error: e.message }, { status: 500 })
    }
}
