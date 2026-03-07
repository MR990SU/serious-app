'use client'
import Image from 'next/image'
import Link from 'next/link'
import { CommentsSection } from '@/components/feed/CommentsSection'
import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Profile } from '@/types'
import { useAuth } from '@/components/AuthProvider'
import { ClickableAvatar } from '@/components/profile/ClickableAvatar'

export default function RightNav() {
    const [creators, setCreators] = useState<Profile[]>([])
    const { user, profile: currentUser } = useAuth()
    const supabase = createClient()

    useEffect(() => {
        const fetchCreators = async () => {
            // Fixed: query 'profiles' table, not non-existent 'users' table
            let query = supabase.from('profiles').select('id, username, avatar_url, bio').limit(5)

            if (user) {
                query = query.neq('id', user.id)
            }

            const { data } = await query
            if (data) setCreators(data as Profile[])
        }
        fetchCreators()
    }, [user])

    return (
        <div className="h-full flex flex-col gap-8 text-sm max-h-screen">

            {/* Desktop Top-Right Profile Badge */}
            {currentUser && (
                <div className="shrink-0 border-b border-white/10 pb-6 px-2">
                    <Link href="/profile/me" prefetch className="flex items-center gap-3 group cursor-pointer hover:bg-white/5 p-2 rounded-xl transition-colors">
                        <div className="w-12 h-12 rounded-full bg-gray-700 overflow-hidden border border-white/10 shrink-0">
                            <ClickableAvatar src={currentUser.avatar_url || null} username={currentUser.username} className="w-full h-full" />
                        </div>
                        <div className="font-bold flex-1 overflow-hidden">
                            <p className="text-white text-base truncate">{currentUser.username}</p>
                            <p className="text-brand-secondary text-xs">View Profile</p>
                        </div>
                    </Link>
                </div>
            )}

            <div className="flex-1 min-h-[50%] overflow-hidden border-b border-white/10 pb-4">
                <CommentsSection />
            </div>

            <section className="shrink-0 pb-20">
                <h3 className="font-bold text-gray-400 mb-4 px-2 shrink-0">Suggested Creators</h3>
                <div className="flex flex-col gap-4">
                    {creators.length === 0 ? (
                        <div className="text-gray-500 text-xs px-2">No suggestions available.</div>
                    ) : (
                        creators.map(creator => (
                            <Link key={creator.id} href={`/profile/${creator.id}`} prefetch className="flex items-center justify-between group cursor-pointer px-2 py-1 hover:bg-white/5 rounded-lg transition-colors">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-full bg-gray-700 overflow-hidden shrink-0">
                                        <ClickableAvatar src={creator.avatar_url || null} username={creator.username} className="w-full h-full" />
                                    </div>
                                    <div>
                                        <p className="font-bold text-sm">{creator.username}</p>
                                        <p className="text-gray-500 text-xs">@{creator.username}</p>
                                    </div>
                                </div>
                                <span className="text-brand-secondary text-xs font-semibold group-hover:text-white transition-colors">Follow</span>
                            </Link>
                        ))
                    )}
                </div>
            </section>
        </div>
    )
}
