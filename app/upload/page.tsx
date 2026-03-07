'use client'
import { useState, useRef, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { CheckCircle2, UploadCloud, Film, Image as ImageIcon, Music } from 'lucide-react'
import { Audio } from '@/types'

type UploadPhase = 'idle' | 'uploading' | 'processing' | 'done' | 'error'

export default function UploadPage() {
  const [file, setFile] = useState<File | null>(null)
  const [mediaType, setMediaType] = useState<'video' | 'photo'>('video')
  const [caption, setCaption] = useState('')
  const [phase, setPhase] = useState<UploadPhase>('idle')
  const [error, setError] = useState('')

  // Audio selection
  const [audioList, setAudioList] = useState<Audio[]>([])
  const [selectedAudioId, setSelectedAudioId] = useState<string | null>(null)
  const [isAudioDrawerOpen, setIsAudioDrawerOpen] = useState(false)

  const supabase = createClient()
  const router = useRouter()

  const ALLOWED_VIDEO = ['video/mp4', 'video/quicktime', 'video/webm']
  const ALLOWED_PHOTO = ['image/jpeg', 'image/png', 'image/webp']
  const MAX_SIZE_BYTES = 100 * 1024 * 1024 // 100MB

  useEffect(() => {
    // Load available audio tracks
    const fetchAudio = async () => {
      const { data } = await supabase.from('audio').select('*').order('used_count', { ascending: false })
      if (data) setAudioList(data)
    }
    fetchAudio()
  }, [supabase])

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0] || null
    if (!selected) return

    const isVideo = ALLOWED_VIDEO.includes(selected.type)
    const isPhoto = ALLOWED_PHOTO.includes(selected.type)

    if (!isVideo && !isPhoto) {
      setError('Only MP4, MOV, WebM videos or JPG, PNG photos are supported.')
      return
    }
    if (selected.size > MAX_SIZE_BYTES) {
      setError('File must be under 100MB.')
      return
    }

    setMediaType(isVideo ? 'video' : 'photo')
    setError('')
    setPhase('idle')
    setFile(selected)
  }

  // --- Generate Thumbnail via Canvas ---
  const generateVideoThumbnail = (videoFile: File): Promise<Blob> => {
    return new Promise((resolve, reject) => {
      const video = document.createElement('video')
      video.autoplay = true
      video.muted = true
      video.playsInline = true
      const url = URL.createObjectURL(videoFile)
      video.src = url

      video.onloadeddata = () => {
        video.currentTime = Math.min(1, video.duration / 2) // Seek to 1s or middle
      }

      video.onseeked = () => {
        const canvas = document.createElement('canvas')
        canvas.width = video.videoWidth
        canvas.height = video.videoHeight
        const ctx = canvas.getContext('2d')
        ctx?.drawImage(video, 0, 0, canvas.width, canvas.height)

        canvas.toBlob(blob => {
          URL.revokeObjectURL(url)
          if (blob) resolve(blob)
          else reject(new Error('Failed to generate thumbnail'))
        }, 'image/jpeg', 0.8)
      }

      video.onerror = () => {
        URL.revokeObjectURL(url)
        reject(new Error('Error loading video file for thumbnail'))
      }
    })
  }

  const handleUpload = async () => {
    if (!file || !caption.trim()) return
    setError('')
    setPhase('uploading')

    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Not authenticated')

      const fileExt = file.name.split('.').pop()
      const fileName = `${user.id}/${Date.now()}.${fileExt}`

      // 1. Upload Media
      const { error: uploadError } = await supabase.storage
        .from('reels-media')
        .upload(fileName, file, { cacheControl: '3600', upsert: false })

      if (uploadError) throw uploadError

      const { data: { publicUrl: mediaUrl } } = supabase.storage
        .from('reels-media')
        .getPublicUrl(fileName)

      // 2. Upload / Generate Thumbnail
      setPhase('processing')
      let thumbnailUrl = mediaUrl // Default to self for photos

      if (mediaType === 'video') {
        try {
          const thumbBlob = await generateVideoThumbnail(file)
          const thumbName = `${user.id}/${Date.now()}_thumb.jpg`

          const { error: thumbErr } = await supabase.storage
            .from('reels-media')
            .upload(thumbName, thumbBlob, { contentType: 'image/jpeg' })

          if (!thumbErr) {
            const { data: thumbData } = supabase.storage
              .from('reels-media')
              .getPublicUrl(thumbName)
            thumbnailUrl = thumbData.publicUrl
          }
        } catch (e) {
          console.warn('Thumbnail generation failed, falling back to empty/default', e)
          // Soft fail: keep default
        }
      }

      // 3. Save to database
      const { error: dbError } = await supabase.from('videos').insert({
        user_id: user.id,
        video_url: mediaUrl,
        media_type: mediaType,
        thumbnail_url: thumbnailUrl,
        audio_id: selectedAudioId,
        caption: caption.trim()
      })

      if (dbError) throw dbError

      setPhase('done')
      setTimeout(() => router.push('/'), 1500)

    } catch (e: any) {
      console.error('Upload failed:', e)
      setError(e.message || 'Upload failed. Please try again.')
      setPhase('error')
    }
  }

  const isUploading = phase === 'uploading' || phase === 'processing'

  const phaseLabel: Record<UploadPhase, string> = {
    idle: 'Post to Feed',
    uploading: 'Uploading to Storage...',
    processing: 'Processing media...',
    done: 'Done! Redirecting...',
    error: 'Retry',
  }

  const selectedAudioInfo = audioList.find(a => a.id === selectedAudioId)

  return (
    <div className="p-6 pt-10 text-white h-full overflow-y-auto pb-24">
      <h1 className="text-2xl font-bold mb-6 flex items-center gap-2">
        <Film size={24} className="text-brand-accent" /> New Post
      </h1>

      <div className="space-y-4 max-w-lg">
        {/* File picker */}
        <div className={`relative border-2 border-dashed rounded-xl p-6 text-center transition-colors ${file ? 'border-brand-accent/40 bg-brand-accent/5' : 'border-white/20 hover:border-white/40'}`}>
          <input
            type="file"
            accept="video/mp4,video/quicktime,video/webm,image/jpeg,image/png,image/webp"
            onChange={handleFileChange}
            disabled={isUploading}
            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer disabled:opacity-0"
          />

          {!file && (
            <div className="flex flex-col items-center gap-2 pointer-events-none">
              <UploadCloud size={32} className="text-gray-400" />
              <span className="font-medium text-gray-300">Tap to select media</span>
            </div>
          )}

          <p className="text-xs text-gray-500 mt-3 pointer-events-none">Videos (MP4/MOV) or Photos (JPG/PNG) · Max 100MB</p>
          {file && (
            <p className="text-sm text-green-400 mt-3 font-medium flex items-center justify-center gap-2 pointer-events-none">
              {mediaType === 'photo' ? <ImageIcon size={16} /> : <Film size={16} />}
              {file.name} ({(file.size / 1024 / 1024).toFixed(1)} MB)
            </p>
          )}
        </div>

        {/* Audio Selector */}
        <div className="bg-gray-900 border border-gray-700 rounded-xl overflow-hidden">
          <button
            type="button"
            onClick={() => setIsAudioDrawerOpen(!isAudioDrawerOpen)}
            className="w-full flex items-center justify-between p-4 bg-gray-900 hover:bg-gray-800 transition-colors"
          >
            <div className="flex items-center gap-3">
              <div className="bg-white/10 p-2 rounded-full">
                <Music size={18} className="text-brand-accent" />
              </div>
              <div className="text-left">
                <p className="font-semibold text-sm">
                  {selectedAudioInfo ? selectedAudioInfo.title : 'Add Audio'}
                </p>
                <p className="text-xs text-gray-400">
                  {selectedAudioInfo ? selectedAudioInfo.artist : 'Select a track for your reel'}
                </p>
              </div>
            </div>
            <span className="text-xs font-bold bg-white/10 px-3 py-1 rounded-full text-white/80">
              {selectedAudioId ? 'Change' : 'Browse'}
            </span>
          </button>

          {/* Audio List Drawer */}
          {isAudioDrawerOpen && (
            <div className="border-t border-gray-800 bg-gray-950 p-2 max-h-60 overflow-y-auto">
              <button
                onClick={() => { setSelectedAudioId(null); setIsAudioDrawerOpen(false); }}
                className={`w-full text-left p-3 rounded-lg text-sm mb-1 ${!selectedAudioId ? 'bg-brand-accent/20 text-brand-accent border border-brand-accent/30' : 'hover:bg-gray-800'}`}
              >
                Original Audio (None)
              </button>
              {audioList.map(audio => (
                <button
                  key={audio.id}
                  onClick={() => { setSelectedAudioId(audio.id); setIsAudioDrawerOpen(false); }}
                  className={`w-full text-left p-3 rounded-lg text-sm mb-1 flex justify-between items-center ${selectedAudioId === audio.id ? 'bg-brand-accent/20 text-brand-accent border border-brand-accent/30' : 'hover:bg-gray-800 text-white'}`}
                >
                  <div>
                    <p className="font-bold">{audio.title}</p>
                    <p className="text-xs opacity-70">{audio.artist}</p>
                  </div>
                  <span className="text-xs opacity-50">{audio.used_count.toLocaleString()} posts</span>
                </button>
              ))}
              {audioList.length === 0 && (
                <div className="p-4 text-center text-sm text-gray-500">No audio tracks available. Add them to the database first.</div>
              )}
            </div>
          )}
        </div>

        {/* Caption */}
        <textarea
          placeholder="Write a caption..."
          value={caption}
          onChange={(e) => setCaption(e.target.value)}
          disabled={isUploading}
          className="w-full bg-gray-900 border border-gray-700 rounded-xl p-3 text-white resize-none focus:outline-none focus:border-brand-accent transition-colors disabled:opacity-50"
          rows={3}
          maxLength={150}
        />
        <p className="text-xs text-gray-500 text-right -mt-2">{caption.length}/150</p>

        {/* Error */}
        {error && (
          <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-lg">
            <p className="text-sm text-red-400">{error}</p>
          </div>
        )}

        {/* Status */}
        {(isUploading || phase === 'done') && (
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm font-medium">
              <span className="text-white/70">{phaseLabel[phase]}</span>
            </div>
            {phase === 'done' && (
              <div className="flex items-center justify-center gap-2 text-green-400 font-bold mt-4">
                <CheckCircle2 size={18} />
                <span>Upload complete!</span>
              </div>
            )}
            {isUploading && (
              <div className="w-full bg-gray-800 h-2 rounded-full overflow-hidden">
                <div className="bg-brand-accent h-full w-1/2 animate-pulse rounded-full" />
              </div>
            )}
          </div>
        )}

        {/* Action buttons */}
        <div className="flex gap-3">
          <button
            onClick={handleUpload}
            disabled={isUploading || !file || !caption.trim() || phase === 'done'}
            className="flex-1 bg-gradient-to-r from-brand-primary to-brand-accent py-4 rounded-xl font-bold disabled:opacity-50 hover:opacity-90 transition-opacity flex items-center justify-center gap-2 shadow-lg shadow-brand-accent/20"
          >
            <UploadCloud size={20} />
            {phaseLabel[phase]}
          </button>
        </div>
      </div>
    </div>
  )
}