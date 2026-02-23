'use client'
import Link from 'next/link'
import { Search, Bell } from 'lucide-react'
import { usePathname } from 'next/navigation'

export default function TopNav() {
  const pathname = usePathname()

  // Hide toggles if not on main feed
  const showToggles = pathname === '/'

  return (
    <div className="w-full p-4 flex flex-col gap-3 md:bg-transparent md:border-none md:backdrop-blur-none relative z-50">
      {/* Top Banner: Logo */}
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold font-sans tracking-tight md:block hidden">Xeel</h1>
      </div>

      {/* Centered Toggles */}
      {showToggles && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 flex items-center gap-2">
          <button className="px-4 py-1.5 rounded-full bg-white/20 backdrop-blur-md border border-white/20 text-sm font-semibold text-white">
            For You
          </button>
          <button className="px-4 py-1.5 rounded-full text-white/60 text-sm font-semibold hover:text-white transition-colors">
            Following
          </button>
        </div>
      )}
    </div>
  )
}
