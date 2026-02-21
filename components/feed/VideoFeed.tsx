'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import VideoItem from './VideoItem'
import { Video } from '@/types'

interface Props {
  initialVideos: Video[]
}

export default function VideoFeed({ initialVideos }: Props) {
  const [videos, setVideos] = useState<Video[]>(initialVideos)
  const [page, setPage] = useState(1)
  const supabase = createClient()
  const BATCH_SIZE = 3

  const fetchVideos = async () => {
    const { data, error } = await supabase
      .from('videos')
      .select('id, user_id, video_url, thumbnail_url, caption, created_at, likes_count, views_count, users(id, username, avatar_url)')
      .order('created_at', { ascending: false })
      .range(page * BATCH_SIZE, (page + 1) * BATCH_SIZE - 1)

    if (error) console.error(error)

    if (data && data.length > 0) {
      // Supabase sometimes returns joined tables as arrays, map it to the expected single Profile object
      const formattedData = data.map((v: any) => ({
        ...v,
        users: Array.isArray(v.users) ? v.users[0] : v.users
      })) as unknown as Video[];

      // Avoid duplicates
      setVideos((prev) => {
        const newVideos = formattedData.filter((v: Video) => !prev.some(p => p.id === v.id))
        return [...prev, ...newVideos]
      })
      setPage((prev) => prev + 1)
    }
  }

  // Removed empty useEffect for initial fetch since we use getServerSideProps/Server Components

  return (
    <div className="h-full w-full overflow-y-scroll snap-y snap-mandatory no-scrollbar">
      {videos.map((video, index) => (
        <VideoItem
          key={video.id}
          video={video}
          index={index}
          loadMore={index === videos.length - 2 ? fetchVideos : undefined}
        />
      ))}
      {videos.length === 0 && (
        <div className="flex items-center justify-center h-full">Loading...</div>
      )}
    </div>
  )
}