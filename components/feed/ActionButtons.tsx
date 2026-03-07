'use client'
import { Heart, MessageCircle, Share2, Disc3, UserCheck, UserPlus, Bookmark } from 'lucide-react'
import { useState, useEffect } from 'react'
import { Video } from '@/types'
import { ShareModal } from './ShareModal'
import { toggleLike } from '@/app/actions/video-actions'
import { toggleFollow } from '@/app/actions/profile-actions'
import { useVideoStore } from '@/lib/store/useVideoStore'
import { CommentDrawer } from './CommentDrawer'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/components/AuthProvider'
import Link from 'next/link'
import { ReelOptionsDrawer } from './ReelOptionsDrawer'
import { MoreHorizontal } from 'lucide-react'
import { ClickableAvatar } from '@/components/profile/ClickableAvatar'

interface Props {
  video: Video
  initialFollowing?: boolean
  initialLiked?: boolean
  initialSaved?: boolean
}

export default function ActionButtons({ video, initialFollowing = false, initialLiked = false, initialSaved = false }: Props) {
  const { activeVideoId, activeVideoLikes, activeVideoComments, incrementLikeCount, decrementLikeCount } = useVideoStore()
  const isActive = activeVideoId === video.id

  // Use AuthProvider context — avoids a redundant getUser() call per video
  const { user } = useAuth()

  const [localLikes, setLocalLikes] = useState(video.likes_count)
  const [liked, setLiked] = useState(initialLiked)
  const [saved, setSaved] = useState(initialSaved)
  const [savedAudio, setSavedAudio] = useState(false)
  const [following, setFollowing] = useState(initialFollowing)
  const [followLoading, setFollowLoading] = useState(false)
  const [isShareOpen, setIsShareOpen] = useState(false)
  const [isCommentOpen, setIsCommentOpen] = useState(false)
  const [isOptionsOpen, setIsOptionsOpen] = useState(false)
  const [mounted, setMounted] = useState(false)

  const supabase = createClient()

  // Only access window after client-side hydration
  useEffect(() => { setMounted(true) }, [])

  // If feed didn't pre-load follow status, fall back to an individual query
  useEffect(() => {
    if (initialFollowing) return           // already provided by feed-level batch
    if (!user || user.id === video.users.id) return

    supabase
      .from('followers')
      .select('follower_id')
      .eq('follower_id', user.id)
      .eq('following_id', video.users.id)
      .maybeSingle()
      .then(({ data }) => setFollowing(!!data))
  }, [video.users.id, user?.id, initialFollowing])

  // Check initial like state on mount (if not pre-loaded)
  useEffect(() => {
    if (initialLiked) return               // already provided
    if (!user) return

    supabase
      .from('likes')
      .select('id')
      .eq('video_id', video.id)
      .eq('user_id', user.id)
      .maybeSingle()
      .then(({ data }) => { if (data) setLiked(true) })
  }, [video.id, user?.id, initialLiked])

  // Check initial save state on mount
  useEffect(() => {
    if (initialSaved) return
    if (!user) return

    supabase
      .from('bookmarks')
      .select('id')
      .eq('video_id', video.id)
      .eq('user_id', user.id)
      .maybeSingle()
      .then(({ data }) => { if (data) setSaved(true) })

    if (video.audio_id) {
      supabase
        .from('saved_audio')
        .select('id')
        .eq('audio_id', video.audio_id)
        .eq('user_id', user.id)
        .maybeSingle()
        .then(({ data }) => { if (data) setSavedAudio(true) })
    }
  }, [video.id, video.audio_id, user?.id, initialSaved])

  const displayLikes = isActive ? activeVideoLikes : localLikes
  const displayComments = isActive ? activeVideoComments : (video.comments_count || 0)
  const isOwnVideo = user?.id === video.users.id

  const handleLike = async () => {
    const newLiked = !liked
    setLiked(newLiked)
    if (isActive) {
      newLiked ? incrementLikeCount() : decrementLikeCount()
    } else {
      setLocalLikes(prev => newLiked ? prev + 1 : prev - 1)
    }

    const result = await toggleLike(video.id)
    if (result && !result.success) {
      setLiked(!newLiked)
      if (isActive) {
        newLiked ? decrementLikeCount() : incrementLikeCount()
      } else {
        setLocalLikes(prev => newLiked ? prev - 1 : prev + 1)
      }
    }
  }

  const handleSave = async () => {
    if (!user) return
    // Optimistic toggle
    const newSaved = !saved
    setSaved(newSaved)

    try {
      const res = await fetch('/api/reels/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ video_id: video.id })
      })
      const data = await res.json()
      if (!data.success) {
        setSaved(!newSaved) // Revert on failure
      }
    } catch {
      setSaved(!newSaved) // Revert on network error
    }
  }

  const handleSaveAudio = async () => {
    if (!user || !video.audio_id) return
    const newSavedAudio = !savedAudio
    setSavedAudio(newSavedAudio)

    try {
      const res = await fetch('/api/audio/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ audio_id: video.audio_id })
      })
      const data = await res.json()
      if (!data.success) setSavedAudio(!newSavedAudio)
    } catch {
      setSavedAudio(!newSavedAudio)
    }
  }

  const handleFollow = async () => {
    if (!user || followLoading) return
    setFollowLoading(true)

    const newFollowing = !following
    setFollowing(newFollowing)

    const result = await toggleFollow(video.users.id)
    if (!result?.success) setFollowing(!newFollowing)
    setFollowLoading(false)
  }

  const shareUrl = mounted
    ? `${window.location.origin}/?v=${video.id}`
    : `/?v=${video.id}`

  return (
    <>
      <div className="absolute bottom-20 right-4 flex flex-col gap-5 items-center z-20 rounded-full py-4 px-2">

        {/* Avatar — opens zoom modal, follow button overlaid */}
        <div className="relative mb-2 shrink-0">
          <div className="w-12 h-12 rounded-full border-2 border-white/50 bg-gray-800 hover:border-brand-accent transition-colors overflow-hidden">
            <ClickableAvatar
              src={video.users.avatar_url || null}
              username={video.users.username}
              className="w-full h-full"
            />
          </div>

          {/* Follow / Following toggle — hidden on own videos */}
          {!isOwnVideo && (
            <button
              onClick={handleFollow}
              disabled={followLoading}
              aria-label={following ? 'Unfollow' : 'Follow'}
              className={`absolute -bottom-3 left-1/2 -translate-x-1/2 rounded-full p-1 shadow-lg transition-all duration-200 ${following
                ? 'bg-white text-black scale-90'
                : 'bg-brand-accent text-white hover:scale-110'
                } disabled:opacity-60`}
            >
              {following
                ? <UserCheck size={13} strokeWidth={2.5} />
                : <UserPlus size={13} strokeWidth={2.5} />}
            </button>
          )}
        </div>

        {/* Like */}
        <button onClick={handleLike} className="flex flex-col items-center group shrink-0">
          <div className={`p-2 rounded-full transition-transform ${liked ? 'scale-110' : 'group-hover:scale-110'} ${liked ? 'text-brand-accent' : 'text-white'}`}>
            <Heart size={30} fill={liked ? 'currentColor' : 'none'} className={liked ? 'drop-shadow-[0_0_8px_rgba(236,72,153,0.8)]' : ''} />
          </div>
          <span className="text-xs font-bold mt-1 text-white/90">{displayLikes}</span>
        </button>

        {/* Comment */}
        <button
          onClick={() => setIsCommentOpen(true)}
          className="flex flex-col items-center group shrink-0"
          aria-label="Open comments"
        >
          <div className="p-2 rounded-full transition-transform group-hover:scale-110">
            <MessageCircle size={30} className="text-white fill-white/20" />
          </div>
          <span className="text-xs font-bold mt-1 text-white/90">{displayComments}</span>
        </button>

        {/* Save */}
        <button
          onClick={handleSave}
          className="flex flex-col items-center group shrink-0"
        >
          <div className="p-2 rounded-full transition-transform group-hover:scale-110">
            <Bookmark size={30} className={saved ? "text-brand-accent fill-brand-accent" : "text-white fill-white/20"} />
          </div>
          <span className="text-xs font-bold mt-1 text-white/90">Save</span>
        </button>

        {/* Share */}
        <button
          onClick={() => setIsShareOpen(true)}
          className="flex flex-col items-center group shrink-0"
        >
          <div className="p-2 rounded-full transition-transform group-hover:scale-110">
            <Share2 size={30} className="text-white fill-white/20" />
          </div>
          <span className="text-xs font-bold mt-1 text-white/90">Share</span>
        </button>

        {/* More Options */}
        <button
          onClick={() => setIsOptionsOpen(true)}
          className="flex flex-col items-center group shrink-0"
        >
          <div className="p-2 rounded-full transition-transform group-hover:scale-110">
            <MoreHorizontal size={30} className="text-white" />
          </div>
        </button>

        {/* Spinning Vinyl */}
        <div className="mt-4 animate-spin shrink-0" style={{ animationDuration: '4s' }}>
          <div className="w-12 h-12 rounded-full bg-gradient-to-tr from-gray-900 to-gray-700 p-1 border border-white/20 flex items-center justify-center">
            <Disc3 size={24} className="text-brand-secondary" />
          </div>
        </div>
      </div>

      {/* Mobile Comment Drawer */}
      <CommentDrawer isOpen={isCommentOpen} onClose={() => setIsCommentOpen(false)} />

      {/* Reel Options Drawer */}
      <ReelOptionsDrawer
        isOpen={isOptionsOpen}
        onClose={() => setIsOptionsOpen(false)}
        video={video}
        savedReel={saved}
        onToggleSavedReel={handleSave}
        savedAudio={savedAudio}
        onToggleSavedAudio={handleSaveAudio}
      />

      {/* Share Modal */}
      <ShareModal
        url={shareUrl}
        title={`Check out this video by @${video.users.username}`}
        isOpen={isShareOpen}
        onClose={() => setIsShareOpen(false)}
      />
    </>
  )
}