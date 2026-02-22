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
    let { data, error } = await supabase
      .from('trending_videos')
      .select('*, users:profiles(id, username, avatar_url)')
      .range(page * BATCH_SIZE, (page + 1) * BATCH_SIZE - 1)

    // If fetch from trending fails or returns no data, fallback to normal query
    if (error || !data || data.length === 0) {
      if (error && Object.keys(error).length > 0) {
        console.warn("VideoFeed Trending fetch warning:", (error as any).message || error)
      }
      const { data: fallbackData, error: fallbackError } = await supabase
        .from('videos')
        .select('*, users:profiles(id, username, avatar_url)')
        .is('deleted_at', null)
        .order('created_at', { ascending: false })
        .range(page * BATCH_SIZE, (page + 1) * BATCH_SIZE - 1)

      if (fallbackError && Object.keys(fallbackError).length > 0) {
        console.error("Fallback videos fetch error:", (fallbackError as any).message || fallbackError)
      }
      data = fallbackData
    } else {
      // Map video_id to standard format from the materialized view
      data = data.map((v: any) => ({ ...v, id: v.video_id }))
    }

    if (error && Object.keys(error).length > 0 && (!data || data.length === 0)) {
      console.error("Final fetch error:", (error as any).message || error)
    }

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

  // Recover if server-side props totally failed
  useEffect(() => {
    if (videos.length === 0) {
      fetchVideos()
    }
  }, [])

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