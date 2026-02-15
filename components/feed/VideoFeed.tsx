'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import VideoItem from './VideoItem'
import { Video } from '@/types'

export default function VideoFeed() {
  const [videos, setVideos] = useState<Video[]>([])
  const [page, setPage] = useState(0)
  const supabase = createClient()
  const BATCH_SIZE = 3

  const fetchVideos = async () => {
    const { data, error } = await supabase
      .from('videos')
      .select('*, users(id, username, avatar_url)')
      .order('created_at', { ascending: false })
      .range(page * BATCH_SIZE, (page + 1) * BATCH_SIZE - 1)

    if (error) console.error(error)
    
    if (data && data.length > 0) {
      // Avoid duplicates
      setVideos((prev) => {
        const newVideos = data.filter(v => !prev.some(p => p.id === v.id))
        return [...prev, ...newVideos]
      })
      setPage((prev) => prev + 1)
    }
  }

  useEffect(() => {
    fetchVideos()
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