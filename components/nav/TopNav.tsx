'use client'
import { usePathname } from 'next/navigation'
import { useVideoStore } from '@/lib/store/useVideoStore'

export default function TopNav() {
  const pathname = usePathname()
  const { feedFilter, setFeedFilter } = useVideoStore()

  const showToggles = pathname === '/'

  return (
    <div className="w-full p-4 flex flex-col gap-3 md:bg-transparent md:border-none md:backdrop-blur-none relative z-50">
      {/* Logo */}
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold font-sans tracking-tight md:block hidden">Xeel</h1>
      </div>

      {/* For You / Following tabs */}
      {showToggles && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 flex items-center gap-1 bg-black/30 backdrop-blur-md rounded-full p-1 border border-white/10">
          <button
            onClick={() => setFeedFilter('forYou')}
            className={`px-4 py-1.5 rounded-full text-sm font-semibold transition-all duration-200 ${feedFilter === 'forYou'
              ? 'bg-white text-black shadow-sm'
              : 'text-white/60 hover:text-white'
              }`}
          >
            For You
          </button>
          <button
            onClick={() => setFeedFilter('following')}
            className={`px-4 py-1.5 rounded-full text-sm font-semibold transition-all duration-200 ${feedFilter === 'following'
              ? 'bg-white text-black shadow-sm'
              : 'text-white/60 hover:text-white'
              }`}
          >
            Following
          </button>
        </div>
      )}
    </div>
  )
}
