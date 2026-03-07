'use client'
import Link from 'next/link'
import { Home, Search, Plus, Bell, User } from 'lucide-react'
import { usePathname } from 'next/navigation'
import clsx from 'clsx'
import { useAuth } from '@/components/AuthProvider'
import { ClickableAvatar } from '@/components/profile/ClickableAvatar'

export default function BottomNav() {
  const pathname = usePathname()
  const { profile } = useAuth()

  if (pathname === '/login' || pathname === '/register') return null

  return (
    <div className="fixed bottom-0 left-0 right-0 pb-safe z-50">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-xl border-t border-white/10" />

      <div className="relative flex justify-around items-center h-16 px-2">
        <Link
          href="/"
          className={clsx('flex flex-col items-center justify-center w-12 h-12 transition-colors', pathname === '/' ? 'text-white' : 'text-white/50')}
        >
          <Home size={24} className={pathname === '/' ? 'fill-white' : ''} />
        </Link>

        <Link
          href="/discover"
          className={clsx('flex flex-col items-center justify-center w-12 h-12 transition-colors', pathname === '/discover' ? 'text-white' : 'text-white/50')}
        >
          <Search size={24} className={pathname === '/discover' ? 'stroke-[3px]' : ''} />
        </Link>

        {/* Create Button */}
        <Link href="/upload" className="flex flex-col items-center justify-center w-14 h-14 -mt-4 relative group">
          <div className="absolute inset-0 bg-electric rounded-2xl blur-md opacity-60 group-hover:opacity-100 transition-opacity" />
          <div className="relative bg-electric rounded-2xl w-12 h-12 flex items-center justify-center text-white font-bold shadow-lg">
            <Plus size={28} />
          </div>
        </Link>

        <Link
          href="/notifications"
          className={clsx('flex flex-col items-center justify-center w-12 h-12 transition-colors', pathname === '/notifications' ? 'text-white' : 'text-white/50')}
        >
          <Bell size={24} className={pathname === '/notifications' ? 'fill-white' : ''} />
        </Link>

        <Link
          href="/profile/me"
          className={clsx('flex flex-col items-center justify-center w-12 h-12 transition-colors relative', pathname.includes('/profile') ? 'text-white' : 'text-white/50')}
        >
          {profile?.avatar_url ? (
            <div className={`w-7 h-7 rounded-full overflow-hidden ${pathname.includes('/profile') ? 'border-[1.5px] border-white' : ''}`}>
              <ClickableAvatar src={profile.avatar_url} username={profile.username || undefined} className="w-full h-full" />
            </div>
          ) : (
            <User size={24} className={pathname.includes('/profile') ? 'fill-white' : ''} />
          )}
        </Link>
      </div>
    </div>
  )
}