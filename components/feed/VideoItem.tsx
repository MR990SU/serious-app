'use client'
import { useRef, useEffect } from 'react'
import { useInView } from 'react-intersection-observer'
import { Video } from '@/types'
import ActionButtons from './ActionButtons'
import Link from 'next/link'

interface Props {
  video: Video
  index: number
  loadMore?: () => void
}

export default function VideoItem({ video, loadMore }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null)
  
  // Logic: Only play when 60% of video is on screen
  const { ref, inView } = useInView({ threshold: 0.6 })

  useEffect(() => {
    if (inView) {
      videoRef.current?.play().catch(e => console.log("Autoplay blocked", e))
      if (loadMore) loadMore()
    } else {
      videoRef.current?.pause()
      if (videoRef.current) videoRef.current.currentTime = 0
    }
  }, [inView, loadMore])

  return (
    <div ref={ref} className="h-full w-full snap-start relative bg-gray-900">
      <video
        ref={videoRef}
        src={video.video_url}
        className="h-full w-full object-cover"
        loop
        playsInline
        muted // Muted initially to satisfy browser policies
        onClick={(e) => e.currentTarget.muted = !e.currentTarget.muted}
      />

      {/* Overlay: Caption & User */}
      <div className="absolute bottom-20 left-4 right-16 z-10 text-shadow">
        <Link href={`/profile/${video.users.id}`} className="font-bold text-lg hover:underline">
          @{video.users.username}
        </Link>
        <p className="mt-2 text-sm line-clamp-2">{video.caption}</p>
      </div>

      <ActionButtons video={video} />
    </div>
  )
}