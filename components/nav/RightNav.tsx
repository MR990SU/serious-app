'use client'
import Image from 'next/image'
import { CommentsSection } from '@/components/feed/CommentsSection'
import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Profile } from '@/types'

export default function RightNav() {
    const [creators, setCreators] = useState<Profile[]>([])
    const supabase = createClient()

    useEffect(() => {
        const fetchCreators = async () => {
            // Fetch users from the users table. To randomize, we could use an RPC, 
            // but for simplicity we'll just fetch a few recent users skipping the current logged in user
            const { data: { user } } = await supabase.auth.getUser()

            let query = supabase.from('users').select('*').limit(3)
            if (user) {
                query = query.neq('id', user.id)
            }

            const { data } = await query
            if (data) setCreators(data as Profile[])
        }
        fetchCreators()
    }, [])

    return (
        <div className="h-full flex flex-col gap-8 text-sm max-h-screen">
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
