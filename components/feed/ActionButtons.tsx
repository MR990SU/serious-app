'use client'
import { Heart, MessageCircle, Share2 } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useState } from 'react'
import { Video } from '@/types'

export default function ActionButtons({ video }: { video: Video }) {
  const [likes, setLikes] = useState(video.likes_count)
  const [liked, setLiked] = useState(false) // In real app, check DB if user liked
  const supabase = createClient()

  const handleLike = async () => {
    // Optimistic UI
    setLiked(!liked)
    setLikes(prev => liked ? prev - 1 : prev + 1)

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return // Handle login redirect here if needed

    // Call RPC function defined in SQL phase
    await supabase.rpc('toggle_like', { 
      _video_id: video.id, 
      _user_id: user.id 
    })
  }

  return (
    <div className="absolute bottom-20 right-2 flex flex-col gap-6 items-center z-20">
      <button onClick={handleLike} className="flex flex-col items-center">
        <div className={`p-2 rounded-full bg-gray-800/50 ${liked ? 'text-red-500' : 'text-white'}`}>
          <Heart size={28} fill={liked ? "currentColor" : "none"} />
        </div>
        <span className="text-xs font-bold mt-1">{likes}</span>
      </button>

      <button className="flex flex-col items-center">
        <div className="p-2 rounded-full bg-gray-800/50">
          <MessageCircle size={28} className="text-white" />
        </div>
        <span className="text-xs font-bold mt-1">0</span>
      </button>

      <button className="flex flex-col items-center">
        <div className="p-2 rounded-full bg-gray-800/50">
          <Share2 size={28} className="text-white" />
        </div>
        <span className="text-xs font-bold mt-1">Share</span>
      </button>
    </div>
  )
}