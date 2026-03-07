import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'

export const revalidate = 30 // Cache response for 30 seconds

export async function GET() {
    const cookieStore = await cookies()
    const supabase = createServerClient(
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

    // Get an estimated count to calculate a safe random offset
    const { count, error: countError } = await supabase
        .from('videos')
        .select('*', { count: 'estimated', head: true })
        .is('deleted_at', null)

    if (countError) {
        return NextResponse.json({ videos: [] }, { status: 500 })
    }

    const total = count || 0
    // We want up to 20 items. If there are fewer than 20, offset must be 0.
    const maxOffset = Math.max(0, total - 20)
    const randomOffset = Math.floor(Math.random() * maxOffset)

    const { data, error } = await supabase
        .from('videos')
        .select('*, users:profiles(id, username, avatar_url, full_name)')
        .is('deleted_at', null)
        .order('created_at', { ascending: false })
        .range(randomOffset, randomOffset + 19)

    if (error) {
        console.error('[/api/explore] Query error:', error.message)
        return NextResponse.json({ videos: [] }, { status: 500 })
    }

    // Normalize user structure
    const videos = data.map((v: any) => ({
        ...v,
        users: Array.isArray(v.users) ? v.users[0] : v.users
    }))

    return NextResponse.json({ videos })
}
