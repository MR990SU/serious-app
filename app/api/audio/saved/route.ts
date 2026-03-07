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
        return NextResponse.json({ audio: [], nextCursor: null }, { status: 401 })
    }

    let query = supabase
        .from('saved_audio')
        .select('created_at, audio!inner(*)')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(FEED_LIMIT)

    if (cursor) {
        query = query.lt('created_at', cursor)
    }

    const { data, error } = await query

    if (error) {
        console.error('[/api/audio/saved] Query error:', error.message)
        return NextResponse.json({ audio: [], nextCursor: null }, { status: 500 })
    }

    // Extract audio out of the saved_audio join
    const audioItems = (data ?? []).map((s: any) => ({
        ...s.audio,
        saved_at: s.created_at
    }))

    const nextCursor = data.length === FEED_LIMIT
        ? audioItems[audioItems.length - 1].saved_at
        : null

    return NextResponse.json({ audio: audioItems, nextCursor })
}
