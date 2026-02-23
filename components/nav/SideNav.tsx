'use client'
import Link from 'next/link'
import { Home, Compass, Radio, MessageSquare, User, Plus } from 'lucide-react'
import { usePathname } from 'next/navigation'
import clsx from 'clsx'
import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'

export default function SideNav() {
    const pathname = usePathname()
    const [avatarUrl, setAvatarUrl] = useState<string | null>(null)

    useEffect(() => {
        const fetchAvatar = async () => {
            const supabase = createClient()
            const { data: { user } } = await supabase.auth.getUser()
            if (user) {
                const { data } = await supabase.from('profiles').select('avatar_url').eq('id', user.id).single()
                if (data?.avatar_url) {
                    setAvatarUrl(data.avatar_url)
                }
            }
        }
        fetchAvatar()
    }, [])

    const links = [
        { href: '/', label: 'Home', icon: Home },
        { href: '/profile/me', label: 'Profile', icon: User },
    ]

    return (
        <div className="h-full flex flex-col">
            <h1 className="text-3xl font-bold mb-8 px-4">Xeel</h1>

            <Link href="/upload" className="flex items-center justify-center gap-2 w-full py-3 mb-8 rounded-2xl bg-electric text-white font-bold overflow-hidden relative group">
                <div className="absolute inset-0 bg-white/20 mix-blend-overlay opacity-0 group-hover:opacity-100 transition-opacity" />
                <Plus size={24} />
            </Link>

            <div className="flex flex-col gap-2 flex-1">
                {links.map((link) => {
                    const isActive = pathname === link.href || (link.href !== '/' && pathname.startsWith(link.href))
                    return (
                        <Link
                            key={link.label}
                            href={link.href}
                            className={clsx(
                                "flex items-center gap-4 px-4 py-3 rounded-xl transition-all duration-300",
                                isActive ? "bg-white/10 font-bold" : "text-white/60 hover:bg-white/5 hover:text-white"
                            )}
                        >
                            {link.label === 'Profile' && avatarUrl ? (
                                <div className={`w-6 h-6 rounded-full overflow-hidden shrink-0 ${isActive ? 'border border-brand-secondary' : 'border border-transparent'}`}>
                                    <img src={avatarUrl} alt="Profile" className="w-full h-full object-cover" />
                                </div>
                            ) : (
                                <link.icon size={24} className={isActive ? "text-brand-secondary" : ""} />
                            )}
                            <span className="text-lg">{link.label}</span>
                        </Link>
                    )
                })}
            </div>
        </div>
    )
}
