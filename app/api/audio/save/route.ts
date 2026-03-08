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
        const audioId = body.audio_id

        const parsed = uuidSchema.safeParse(audioId)
        if (!parsed.success) {
            return NextResponse.json({ success: false, error: 'Invalid audio ID' }, { status: 400 })
        }

        const { data: existing } = await supabase
            .from('saved_audio')
            .select('id')
            .eq('user_id', user.id)
            .eq('audio_id', audioId)
            .single()

        if (existing) {
            const { error } = await supabase.from('saved_audio').delete().eq('id', existing.id)
            if (error) throw error
            return NextResponse.json({ success: true, saved: false })
        } else {
            const { error } = await supabase.from('saved_audio').insert({ user_id: user.id, audio_id: audioId })
            if (error) throw error
            return NextResponse.json({ success: true, saved: true })
        }

    } catch (e: unknown) {
        return NextResponse.json({ success: false, error: (e as Error).message }, { status: 500 })
    }
}
