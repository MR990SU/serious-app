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
        const { blocked_user_id } = await request.json()
        if (!blocked_user_id) return NextResponse.json({ success: false, error: 'Missing blocked_user_id' }, { status: 400 })
        if (blocked_user_id === user.id) return NextResponse.json({ success: false, error: 'Cannot block self' }, { status: 400 })

        // Check if block exists
        const { data: existingBlock } = await supabase
            .from('blocked_users')
            .select('user_id')
            .eq('user_id', user.id)
            .eq('blocked_user_id', blocked_user_id)
            .single()

        if (existingBlock) {
            // Unblock
            const { error: deleteError } = await supabase
                .from('blocked_users')
                .delete()
                .eq('user_id', user.id)
                .eq('blocked_user_id', blocked_user_id)

            if (deleteError) throw deleteError
            return NextResponse.json({ success: true, isBlocked: false })
        } else {
            // Block
            const { error: insertError } = await supabase
                .from('blocked_users')
                .insert({ user_id: user.id, blocked_user_id })

            if (insertError) throw insertError
            return NextResponse.json({ success: true, isBlocked: true })
        }
    } catch (e: any) {
        console.error('[/api/users/block]', e.message)
        return NextResponse.json({ success: false, error: e.message }, { status: 500 })
    }
}
