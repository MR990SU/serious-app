'use client'
import Image from 'next/image'
import Link from 'next/link'
import { CommentsSection } from '@/components/feed/CommentsSection'
import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Profile } from '@/types'

export default function RightNav() {
    const [creators, setCreators] = useState<Profile[]>([])
    const [currentUser, setCurrentUser] = useState<Profile | null>(null)
    const supabase = createClient()

    useEffect(() => {
        const fetchCreatorsAndUser = async () => {
            const { data: { user } } = await supabase.auth.getUser()

            let query = supabase.from('users').select('*').limit(3)

            if (user) {
                // Fetch logged-in user profile for the desktop top-right badge
                const { data: profile } = await supabase.from('profiles').select('*').eq('id', user.id).single()
                if (profile) setCurrentUser(profile)

                // Exclude current user from suggested creators
                query = query.neq('id', user.id)
            }

            const { data } = await query
            if (data) setCreators(data as Profile[])
        }
        fetchCreatorsAndUser()
    }, [])

    return (
        <div className="h-full flex flex-col gap-8 text-sm max-h-screen">

            {/* Desktop Top-Right Profile Option */}
            {currentUser && (
                <div className="shrink-0 border-b border-white/10 pb-6 px-2">
                    <Link href="/profile/me" className="flex items-center gap-3 group cursor-pointer hover:bg-white/5 p-2 rounded-xl transition-colors">
                        <div className="w-12 h-12 rounded-full bg-gray-700 overflow-hidden border border-white/10 shrink-0">
                            {currentUser.avatar_url ? (
                                <img src={currentUser.avatar_url} alt="Profile" className="w-full h-full object-cover" />
                            ) : (
                                <div className="w-full h-full bg-gradient-to-tr from-brand-secondary to-brand-primary" />
                            )}
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
                            <div key={creator.id} className="flex items-center justify-between group cursor-pointer px-2 py-1 hover:bg-white/5 rounded-lg transition-colors">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-full bg-gray-700 overflow-hidden">
                                        {creator.avatar_url ? (
                                            <img src={creator.avatar_url} alt={creator.username} className="w-full h-full object-cover" />
                                        ) : (
                                            <div className="w-full h-full bg-gradient-to-tr from-gray-600 to-gray-400" />
                                        )}
                                    </div>
                                    <div>
                                        <p className="font-bold text-sm">{creator.username}</p>
                                        <p className="text-gray-500 text-xs">@{creator.username}</p>
                                    </div>
                                </div>
                                <span className="text-gray-600 group-hover:text-white transition-colors">••</span>
                            </div>
                        ))
                    )}
                </div>
            </section>
        </div>
    )
}
