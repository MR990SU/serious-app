'use client'
import Link from 'next/link'
import { Home, Compass, Plus, Heart, User, Search, Bell } from 'lucide-react'
import { usePathname } from 'next/navigation'
import clsx from 'clsx'
import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'

export default function BottomNav() {
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

  if (pathname === '/login' || pathname === '/register') return null

  return (
    <div className="fixed bottom-0 left-0 right-0 pb-safe z-50">
      {/* Background with blur */}
      <div className="absolute inset-0 border-t-0 border-b-0 border-x-0" />

      <div className="relative flex justify-around items-center h-16 px-2">
        <Link href="/" className={clsx("flex flex-col items-center justify-center w-12 h-12 transition-colors", pathname === '/' ? "text-white" : "text-white/50")}>
          <Home size={24} className={pathname === '/' ? "fill-white" : ""} />
        </Link>

        {/* Search / Discover */}
        <Link href="/discover" className={clsx("flex flex-col items-center justify-center w-12 h-12 transition-colors", pathname === '/discover' ? "text-white" : "text-white/50")}>
          <Search size={24} className={pathname === '/discover' ? "stroke-[3px]" : ""} />
        </Link>

        {/* Create Button Centered */}
        <Link href="/upload" className="flex flex-col items-center justify-center w-14 h-14 -mt-4 relative group">
          <div className="absolute inset-0 bg-electric rounded-2xl blur-md opacity-60 group-hover:opacity-100 transition-opacity" />
          <div className="relative bg-electric rounded-2xl w-12 h-12 flex items-center justify-center text-white font-bold shadow-lg">
            <Plus size={28} />
          </div>
        </Link>

        {/* Notifications */}
        <Link href="/notifications" className={clsx("flex flex-col items-center justify-center w-12 h-12 transition-colors", pathname === '/notifications' ? "text-white" : "text-white/50")}>
          <Bell size={24} className={pathname === '/notifications' ? "fill-white" : ""} />
        </Link>

        {/* Profile */}
        <Link href="/profile/me" className={clsx("flex flex-col items-center justify-center w-12 h-12 transition-colors relative", pathname.includes('/profile') ? "text-white" : "text-white/50")}>
          {avatarUrl ? (
            <div className={`w-7 h-7 rounded-full overflow-hidden ${pathname.includes('/profile') ? 'border-[1.5px] border-white' : ''}`}>
              <img src={avatarUrl} alt="Profile" className="w-full h-full object-cover" />
            </div>
          ) : (
            <User size={24} className={pathname.includes('/profile') ? "fill-white" : ""} />
          )}
        </Link>
      </div>
    </div>
  )
}