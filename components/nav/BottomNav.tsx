'use client'
import Link from 'next/link'
import { Home, Compass, Plus, Heart, User } from 'lucide-react'
import { usePathname } from 'next/navigation'
import clsx from 'clsx'

export default function BottomNav() {
  const pathname = usePathname()

  if (pathname === '/login') return null

  return (
    <div className="fixed bottom-0 left-0 right-0 pb-safe z-50">
      {/* Background with blur */}
      <div className="absolute inset-0 glass-dark border-t-0 border-b-0 border-x-0" />

      <div className="relative flex justify-around items-center h-16 px-2">
        <Link href="/" className={clsx("flex flex-col items-center justify-center w-12 h-12 transition-colors", pathname === '/' ? "text-white drop-shadow-[0_0_8px_rgba(255,255,255,0.5)]" : "text-white/50")}>
          <Home size={24} className={pathname === '/' ? "fill-white" : ""} />
        </Link>

        {/* Create Button Centered */}
        <Link href="/upload" className="flex flex-col items-center justify-center w-14 h-14 -mt-4 relative group">
          <div className="absolute inset-0 bg-electric rounded-2xl blur-md opacity-60 group-hover:opacity-100 transition-opacity" />
          <div className="relative bg-electric rounded-2xl w-12 h-12 flex items-center justify-center text-white font-bold shadow-lg">
            <Plus size={28} />
          </div>
        </Link>

        {/* Profile */}
        <Link href="/profile/me" className={clsx("flex flex-col items-center justify-center w-12 h-12 transition-colors", pathname.includes('/profile') ? "text-white" : "text-white/50")}>
          <User size={24} />
        </Link>
      </div>
    </div>
  )
}