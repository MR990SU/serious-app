'use client'
import Link from 'next/link'
import { Home, PlusSquare, User } from 'lucide-react'
import { usePathname } from 'next/navigation'
import clsx from 'clsx'

export default function BottomNav() {
  const pathname = usePathname()

  // Don't show on login page
  if (pathname === '/login') return null

  return (
    <div className="fixed bottom-0 left-0 right-0 h-16 bg-black border-t border-gray-800 flex justify-around items-center z-50">
      <Link href="/" className={clsx("p-2", pathname === '/' ? "text-white" : "text-gray-500")}>
        <Home size={28} />
      </Link>
      
      <Link href="/upload" className="p-2">
        <div className="bg-white rounded-lg px-4 py-1">
          <PlusSquare size={24} className="text-black" />
        </div>
      </Link>

      {/* Note: In real app, fetch user ID to link to own profile */}
      <Link href="/profile/me" className={clsx("p-2", pathname.includes('/profile') ? "text-white" : "text-gray-500")}>
        <User size={28} />
      </Link>
    </div>
  )
}