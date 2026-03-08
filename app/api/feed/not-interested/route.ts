import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
    const cookieStore = await cookies()
    const supabase = createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        {
            cookies: {
                getAll() {
                    return cookieStore.getAll()
                },
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

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })

    try {
        const { creator_id } = await request.json()
        if (!creator_id) return NextResponse.json({ success: false, error: 'Missing creator_id' }, { status: 400 })
        if (creator_id === user.id) return NextResponse.json({ success: false, error: 'Cannot mark self as not interested' }, { status: 400 })

        // Check if already not interested
        const { data: existing } = await supabase
            .from('not_interested')
            .select('user_id')
            .eq('user_id', user.id)
            .eq('creator_id', creator_id)
            .single()

        if (existing) {
            // Undo Not Interested
            const { error: deleteError } = await supabase
                .from('not_interested')
                .delete()
                .eq('user_id', user.id)
                .eq('creator_id', creator_id)

            if (deleteError) throw deleteError
            return NextResponse.json({ success: true, isNotInterested: false })
        } else {
            // Mark Not Interested
            const { error: insertError } = await supabase
                .from('not_interested')
                .insert({ user_id: user.id, creator_id })

            if (insertError) throw insertError
            return NextResponse.json({ success: true, isNotInterested: true })
        }
    } catch (e: unknown) {
        console.error('[/api/feed/not-interested]', (e as Error).message)
        return NextResponse.json({ success: false, error: (e as Error).message }, { status: 500 })
    }
}
