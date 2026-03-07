import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextRequest, NextResponse } from 'next/server'

const FEED_LIMIT = 12

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
        return NextResponse.json({ posts: [], nextCursor: null }, { status: 401 })
    }

    let query = supabase
        .from('bookmarks')
        .select('created_at, videos!inner(*, users:profiles(id, username, avatar_url))')
        .eq('user_id', user.id)
        .is('videos.deleted_at', null)
        .order('created_at', { ascending: false })
        .limit(FEED_LIMIT)

    if (cursor) {
        query = query.lt('created_at', cursor)
    }

    const { data, error } = await query

    if (error) {
        console.error('[/api/reels/saved] Query error:', error.message)
        return NextResponse.json({ posts: [], nextCursor: null }, { status: 500 })
    }

    // Extract videos out of the bookmarks join and normalize users
    const posts = (data ?? []).map((b: any) => {
        const v = b.videos
        return {
            ...v,
            users: Array.isArray(v.users) ? v.users[0] : v.users,
            saved_at: b.created_at // Used for cursor pagination
        }
    })

    const nextCursor = data.length === FEED_LIMIT
        ? posts[posts.length - 1].saved_at
        : null

    return NextResponse.json({ posts, nextCursor })
}
