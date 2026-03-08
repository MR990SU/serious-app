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
    const filter = searchParams.get('filter') || 'forYou'

    const supabase = await getSupabase()
    const { data: { user } } = await supabase.auth.getUser()

    // ── Build suppression lists (single query) ────────────────────────
    let blockedIds: string[] = []
    let notInterestedIds: string[] = []

    if (user) {
        const [blockedRes, notIntRes] = await Promise.all([
            supabase.from('blocked_users').select('blocked_user_id').eq('user_id', user.id),
            supabase.from('not_interested').select('creator_id').eq('user_id', user.id)
        ])

        if (blockedRes.data) blockedIds = blockedRes.data.map(b => b.blocked_user_id)
        if (notIntRes.data) notInterestedIds = notIntRes.data.map(n => n.creator_id)
    }

    // ── Build base query ──────────────────────────────────────────────
    // Over-fetch by 30 to allow suppression filters room to build a full batch of 12
    const FETCH_BUFFER = 30
    let query = supabase
        .from('videos')
        .select('*, users:profiles(id, username, avatar_url), audio:audio(*)')
        .is('deleted_at', null)
        .order('created_at', { ascending: false })
        .limit(FETCH_BUFFER)

    // Cursor pagination — fetch videos older than cursor
    if (cursor) {
        query = query.lt('created_at', cursor)
    }

    // Exclude blocked users
    if (blockedIds.length > 0) {
        // Supabase JS v2: .not('column', 'in', '(val1,val2)')
        query = query.not('user_id', 'in', `(${blockedIds.join(',')})`)
    }

    // ── Following filter ──────────────────────────────────────────────
    if (filter === 'following' && user) {
        const { data: followData } = await supabase
            .from('followers')
            .select('following_id')
            .eq('follower_id', user.id)

        if (followData && followData.length > 0) {
            const followingIds = followData.map(f => f.following_id)
            query = query.in('user_id', followingIds)
        } else {
            // Not following anyone — return empty
            return NextResponse.json({ posts: [], nextCursor: null })
        }
    }

    const { data, error } = await query

    if (error) {
        console.error('[/api/feed] Query error:', error.message)
        return NextResponse.json({ posts: [], nextCursor: null }, { status: 500 })
    }

    // Normalize joined users and audio (Supabase sometimes returns array)
    const normalizedData = (data ?? []).map((v: any) => ({
        ...v,
        users: Array.isArray(v.users) ? v.users[0] : v.users,
        audio: Array.isArray(v.audio) ? v.audio[0] : v.audio,
    }))

    // ── Apply Suppression Logic ───────────────────────────────────────
    const posts = []
    for (const post of normalizedData) {
        if (posts.length >= FEED_LIMIT) break // We hit our 12 goal

        const creatorId = post.users?.id
        if (creatorId && notInterestedIds.includes(creatorId)) {
            // 80% chance to drop this creator's post
            if (Math.random() < 0.8) continue
        }

        posts.push(post)
    }

    // Next cursor is the created_at of the last item in our FILTERED list
    // If our resulting list is smaller than FEED_LIMIT, but the original FETCH_BUFFER returned its maximum,
    // we should still provide a cursor using the very last item of the FETCHED data to continue paginating smoothly
    let nextCursor = null
    if (posts.length === FEED_LIMIT) {
        nextCursor = posts[posts.length - 1].created_at
    } else if (normalizedData.length === FETCH_BUFFER) {
        nextCursor = normalizedData[normalizedData.length - 1].created_at
    }

    return NextResponse.json({ posts, nextCursor })
}
