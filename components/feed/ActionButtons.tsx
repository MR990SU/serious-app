'use client'
import { Heart, MessageCircle, Share2, Plus, Disc3 } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useState } from 'react'
import { Video } from '@/types'
import Image from 'next/image'
import { ShareModal } from './ShareModal'

export default function ActionButtons({ video }: { video: Video }) {
  const [likes, setLikes] = useState(video.likes_count)
  const [liked, setLiked] = useState(false)
  const [isShareOpen, setIsShareOpen] = useState(false)
  const supabase = createClient()

  const handleLike = async () => {
    // Optimistic UI
    setLiked(!liked)
    setLikes(prev => liked ? prev - 1 : prev + 1)

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    await supabase.rpc('toggle_like', {
      _video_id: video.id,
      _user_id: user.id
    })
  }

  return (
    <>
      <div className="absolute bottom-20 right-4 flex flex-col gap-5 items-center z-20 glass-dark rounded-full py-4 px-2">

        {/* Avatar with Follow Button */}
        <div className="relative mb-2 shrink-0">
          <div className="w-12 h-12 rounded-full overflow-hidden border-2 border-white/50 bg-gray-800">
            {video.users.avatar_url ? (
              <img src={video.users.avatar_url} alt={video.users.username} className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full bg-gradient-to-tr from-brand-secondary to-brand-primary" />
            )}
          </div>
          <button className="absolute -bottom-2 left-1/2 -translate-x-1/2 bg-brand-accent text-white rounded-full p-0.5 shadow-lg">
            <Plus size={14} strokeWidth={3} />
          </button>
        </div>

        <button onClick={handleLike} className="flex flex-col items-center group shrink-0">
          <div className={`p-2 rounded-full transition-transform ${liked ? 'scale-110' : 'group-hover:scale-110'} ${liked ? 'text-brand-accent' : 'text-white'}`}>
            <Heart size={30} fill={liked ? "currentColor" : "none"} className={liked ? "drop-shadow-[0_0_8px_rgba(236,72,153,0.8)]" : ""} />
          </div>
          <span className="text-xs font-bold mt-1 text-white/90">{likes}</span>
        </button>

        <button className="flex flex-col items-center group shrink-0">
          <div className="p-2 rounded-full transition-transform group-hover:scale-110">
            <MessageCircle size={30} className="text-white fill-white/20" />
          </div>
          <span className="text-xs font-bold mt-1 text-white/90">0</span>
        </button>

        <button
          onClick={() => setIsShareOpen(true)}
          className="flex flex-col items-center group shrink-0"
        >
          <div className="p-2 rounded-full transition-transform group-hover:scale-110">
            <Share2 size={30} className="text-white fill-white/20" />
          </div>
          <span className="text-xs font-bold mt-1 text-white/90">Share</span>
        </button>

        {/* Sound / Remix Spinning Vinyl */}
        <div className="mt-4 animate-spin shrink-0" style={{ animationDuration: '4s' }}>
          <div className="w-12 h-12 rounded-full bg-gradient-to-tr from-gray-900 to-gray-700 p-1 border border-white/20 flex items-center justify-center">
            <Disc3 size={24} className="text-brand-secondary" />
          </div>
        </div>
      </div>

      <ShareModal
        url={typeof window !== 'undefined' ? window.location.origin + `/?v=${video.id}` : ''}
        title={`Check out this video by @${video.users.username}`}
        isOpen={isShareOpen}
        onClose={() => setIsShareOpen(false)}
      />
    </>
  )
}