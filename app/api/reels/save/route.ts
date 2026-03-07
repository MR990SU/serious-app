import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'

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

export async function POST(request: NextRequest) {
    const supabase = await getSupabase()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
        return NextResponse.json({ success: false, error: 'Not authenticated' }, { status: 401 })
    }

    try {
        const body = await request.json()
        const videoId = body.video_id

        const parsed = uuidSchema.safeParse(videoId)
        if (!parsed.success) {
            return NextResponse.json({ success: false, error: 'Invalid video ID' }, { status: 400 })
        }

        // Toggle logic: delete if exists, insert if not
        const { data: existing } = await supabase
            .from('bookmarks')
            .select('id')
            .eq('user_id', user.id)
            .eq('video_id', videoId)
            .single()

        if (existing) {
            const { error } = await supabase.from('bookmarks').delete().eq('id', existing.id)
            if (error) throw error
            return NextResponse.json({ success: true, saved: false })
        } else {
            const { error } = await supabase.from('bookmarks').insert({ user_id: user.id, video_id: videoId })
            if (error) throw error
            return NextResponse.json({ success: true, saved: true })
        }

    } catch (e: any) {
        return NextResponse.json({ success: false, error: e.message }, { status: 500 })
    }
}
