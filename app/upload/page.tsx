'use client'
import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { CheckCircle2, UploadCloud, Film, Image as ImageIcon, FileAudio } from 'lucide-react'
import { Audio } from '@/types'

type UploadMode = 'video' | 'image_audio' | 'video_audio'
type UploadPhase = 'idle' | 'uploading' | 'processing' | 'done' | 'error'

const MODE_CONFIG: Record<UploadMode, { label: string; description: string; icon: React.ReactNode }> = {
  video: {
    label: 'Video',
    description: 'Upload a short video reel',
    icon: <Film size={16} />,
  },
  image_audio: {
    label: 'Image + Audio',
    description: 'Static image with a music track',
    icon: <ImageIcon size={16} />,
  },
  video_audio: {
    label: 'Video + Audio',
    description: 'Video with an audio overlay (video muted)',
    icon: <FileAudio size={16} />,
  },
}

const ALLOWED_VIDEO = ['video/mp4', 'video/quicktime', 'video/webm']
const ALLOWED_PHOTO = ['image/jpeg', 'image/png', 'image/webp']
const ALLOWED_AUDIO = ['audio/mpeg', 'audio/mp3', 'audio/wav', 'audio/ogg', 'audio/aac']
const MAX_SIZE_BYTES = 100 * 1024 * 1024 // 100MB

export default function UploadPage() {
  const [uploadMode, setUploadMode] = useState<UploadMode>('video')

  // Per-slot file state
  const [videoFile, setVideoFile] = useState<File | null>(null)
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [audioFile, setAudioFile] = useState<File | null>(null)

  const [caption, setCaption] = useState('')
  const [phase, setPhase] = useState<UploadPhase>('idle')
  const [error, setError] = useState('')
  const [progress, setProgress] = useState(0)

  // Audio library selection (for image_audio mode only)
  const [audioList, setAudioList] = useState<Audio[]>([])
  const [selectedAudioId, setSelectedAudioId] = useState<string | null>(null)
  const supabase = createClient()
  const router = useRouter()

  useEffect(() => {
    const fetchAudio = async () => {
      const { data } = await supabase.from('audio').select('*').order('used_count', { ascending: false })
      if (data) setAudioList(data)
    }
    fetchAudio()
  }, [supabase])

  // Reset file selections when mode changes
  const handleModeChange = (mode: UploadMode) => {
    setUploadMode(mode)
    setVideoFile(null)
    setImageFile(null)
    setAudioFile(null)
    setSelectedAudioId(null)
    setError('')
    setPhase('idle')
  }

  const pickFile = (
    e: React.ChangeEvent<HTMLInputElement>,
    slot: 'video' | 'image' | 'audio'
  ) => {
    const selected = e.target.files?.[0] || null
    // Reset input so same file can be re-selected
    e.target.value = ''
    if (!selected) return

    if (selected.size > MAX_SIZE_BYTES) {
      setError('File must be under 100MB.')
      return
    }

    if (slot === 'video' && !ALLOWED_VIDEO.includes(selected.type)) {
      setError('Video must be MP4, MOV, or WebM.')
      return
    }
    if (slot === 'image' && !ALLOWED_PHOTO.includes(selected.type)) {
      setError('Image must be JPG, PNG, or WebP.')
      return
    }
    if (slot === 'audio' && !ALLOWED_AUDIO.includes(selected.type)) {
      setError('Audio must be MP3, WAV, OGG, or AAC.')
      return
    }

    setError('')
    if (slot === 'video') setVideoFile(selected)
    if (slot === 'image') setImageFile(selected)
    if (slot === 'audio') setAudioFile(selected)
  }

  const generateVideoThumbnail = (vFile: File): Promise<Blob> => {
    return new Promise((resolve, reject) => {
      const video = document.createElement('video')
      video.autoplay = true
      video.muted = true
      video.playsInline = true
      const url = URL.createObjectURL(vFile)
      video.src = url

      video.onloadeddata = () => {
        video.currentTime = Math.min(1, video.duration / 2)
      }
      video.onseeked = () => {
        const canvas = document.createElement('canvas')
        canvas.width = video.videoWidth
        canvas.height = video.videoHeight
        canvas.getContext('2d')?.drawImage(video, 0, 0, canvas.width, canvas.height)
        canvas.toBlob(blob => {
          URL.revokeObjectURL(url)
          if (blob) resolve(blob)
          else reject(new Error('Failed to generate thumbnail'))
        }, 'image/jpeg', 0.8)
      }
      video.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Error loading video')) }
    })
  }

  const uploadToStorage = async (file: File, path: string): Promise<string> => {
    // Step 1: Get a signed upload URL from Supabase
    const { data: signedData, error: signedError } = await supabase.storage
      .from('reels-media')
      .createSignedUploadUrl(path)
    if (signedError || !signedData) throw signedError ?? new Error('Failed to get signed URL')

    const { signedUrl } = signedData

    // Step 2: XHR PUT to the signed URL — exposes onprogress events
    await new Promise<void>((resolve, reject) => {
      const xhr = new XMLHttpRequest()
      xhr.open('PUT', signedUrl)
      xhr.setRequestHeader('x-upsert', 'false')

      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable) setProgress(Math.round((e.loaded / e.total) * 100))
      }

      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) resolve()
        else reject(new Error(`Upload failed: ${xhr.status} — ${xhr.responseText}`))
      }

      xhr.onerror = () => reject(new Error('Network error during upload'))
      xhr.send(file)
    })

    // Step 3: Retrieve the public URL
    return supabase.storage.from('reels-media').getPublicUrl(path).data.publicUrl
  }

  const validate = (): string | null => {
    if (!caption.trim()) return 'Caption is required.'
    if (uploadMode === 'video' && !videoFile) return 'A video file is required.'
    if (uploadMode === 'image_audio' && !imageFile) return 'An image file is required.'
    if (uploadMode === 'image_audio' && !audioFile && !selectedAudioId) return 'An audio track or library audio is required.'
    if (uploadMode === 'video_audio' && !videoFile) return 'A video file is required.'
    if (uploadMode === 'video_audio' && !audioFile) return 'An audio file is required for Video + Audio mode.'
    return null
  }

  const handleUpload = async () => {
    const validationError = validate()
    if (validationError) { setError(validationError); return }

    setError('')
    setPhase('uploading')

    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Not authenticated')

      const ts = Date.now()
      let videoUrl: string | null = null
      let imageUrl: string | null = null
      let audioUrl: string | null = null
      let thumbnailUrl: string | null = null
      const audioId: string | null = selectedAudioId

      // ── Video only ──────────────────────────────────────
      if (uploadMode === 'video') {
        const ext = videoFile!.name.split('.').pop()
        videoUrl = await uploadToStorage(videoFile!, `${user.id}/${ts}.${ext}`)

        setPhase('processing')
        try {
          const thumbBlob = await generateVideoThumbnail(videoFile!)
          thumbnailUrl = await uploadToStorage(
            new File([thumbBlob], 'thumb.jpg', { type: 'image/jpeg' }),
            `${user.id}/${ts}_thumb.jpg`
          )
        } catch { /* soft fail */ }
      }

      // ── Image + Audio ───────────────────────────────────
      if (uploadMode === 'image_audio') {
        const imgExt = imageFile!.name.split('.').pop()
        imageUrl = await uploadToStorage(imageFile!, `${user.id}/${ts}_img.${imgExt}`)
        thumbnailUrl = imageUrl // image IS the thumbnail

        if (audioFile) {
          const audExt = audioFile.name.split('.').pop()
          audioUrl = await uploadToStorage(audioFile, `${user.id}/${ts}_audio.${audExt}`)
        }
      }

      // ── Video + Audio (video muted) ──────────────────────
      if (uploadMode === 'video_audio') {
        const vExt = videoFile!.name.split('.').pop()
        videoUrl = await uploadToStorage(videoFile!, `${user.id}/${ts}.${vExt}`)

        const audExt = audioFile!.name.split('.').pop()
        audioUrl = await uploadToStorage(audioFile!, `${user.id}/${ts}_audio.${audExt}`)

        setPhase('processing')
        try {
          const thumbBlob = await generateVideoThumbnail(videoFile!)
          thumbnailUrl = await uploadToStorage(
            new File([thumbBlob], 'thumb.jpg', { type: 'image/jpeg' }),
            `${user.id}/${ts}_thumb.jpg`
          )
        } catch { /* soft fail */ }
      }

      // ── DB insert ───────────────────────────────────────
      const dbPayload: Record<string, unknown> = {
        user_id: user.id,
        caption: caption.trim(),
        upload_mode: uploadMode,
        media_type: uploadMode === 'image_audio' ? 'photo' : 'video',
        thumbnail_url: thumbnailUrl,
        audio_id: audioId,
      }

      if (videoUrl) dbPayload.video_url = videoUrl
      if (imageUrl) dbPayload.image_url = imageUrl
      if (audioUrl) dbPayload.audio_url = audioUrl

      // video_audio mode: flag that video audio should be suppressed
      if (uploadMode === 'video_audio') dbPayload.mute_video_audio = true

      // Ensure video_url is set to image_url for photo posts so existing feed code works
      if (uploadMode === 'image_audio') dbPayload.video_url = imageUrl

      const { error: dbError } = await supabase.from('videos').insert(dbPayload)
      if (dbError) throw dbError

      setPhase('done')
      setTimeout(() => router.push('/'), 1500)

    } catch (e: unknown) {
      console.error('Upload failed:', e)
      setError((e as Error).message || 'Upload failed. Please try again.')
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

  return (
    <div className="p-6 pt-10 text-white h-full overflow-y-auto pb-24">
      <h1 className="text-2xl font-bold mb-6 flex items-center gap-2">
        <Film size={24} className="text-brand-accent" /> New Post
      </h1>

      <div className="space-y-4 max-w-lg">

        {/* ── Mode Selector ── */}
        <div>
          <p className="text-xs text-gray-400 font-semibold mb-2 uppercase tracking-widest">Upload Mode</p>
          <div className="grid grid-cols-3 gap-2">
            {(Object.entries(MODE_CONFIG) as [UploadMode, typeof MODE_CONFIG[UploadMode]][]).map(([mode, cfg]) => (
              <button
                key={mode}
                type="button"
                onClick={() => handleModeChange(mode)}
                disabled={isUploading}
                className={`flex flex-col items-center gap-1 p-3 rounded-xl border text-xs font-semibold transition-all ${uploadMode === mode
                  ? 'border-brand-accent bg-brand-accent/10 text-brand-accent'
                  : 'border-gray-700 bg-gray-900 text-gray-400 hover:border-gray-500'
                  }`}
              >
                {cfg.icon}
                <span>{cfg.label}</span>
              </button>
            ))}
          </div>
          <p className="text-xs text-gray-500 mt-1.5">{MODE_CONFIG[uploadMode].description}</p>
        </div>

        {/* ── File Slots ── */}

        {/* Video slot — modes: video, video_audio */}
        {(uploadMode === 'video' || uploadMode === 'video_audio') && (
          <FileSlot
            label="Video"
            icon={<Film size={16} />}
            accept="video/mp4,video/quicktime,video/webm"
            file={videoFile}
            onPick={e => pickFile(e, 'video')}
            disabled={isUploading}
          />
        )}

        {/* Image slot — mode: image_audio */}
        {uploadMode === 'image_audio' && (
          <FileSlot
            label="Image"
            icon={<ImageIcon size={16} />}
            accept="image/jpeg,image/png,image/webp"
            file={imageFile}
            onPick={e => pickFile(e, 'image')}
            disabled={isUploading}
          />
        )}

        {/* Audio file slot — modes: video_audio, image_audio */}
        {(uploadMode === 'video_audio' || uploadMode === 'image_audio') && (
          <FileSlot
            label="Audio File"
            icon={<FileAudio size={16} />}
            accept="audio/mpeg,audio/mp3,audio/wav,audio/ogg,audio/aac"
            file={audioFile}
            onPick={e => pickFile(e, 'audio')}
            disabled={isUploading}
          />
        )}

        {/* Caption */}
        <textarea
          placeholder="Write a caption..."
          value={caption}
          onChange={e => setCaption(e.target.value)}
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
              <div className="space-y-1">
                <div className="w-full bg-gray-800 h-2 rounded-full overflow-hidden">
                  <div
                    className="bg-brand-accent h-full rounded-full transition-all duration-300"
                    style={{ width: `${progress}%` }}
                  />
                </div>
                <p className="text-xs text-gray-400 text-right">{progress}%</p>
              </div>
            )}
          </div>
        )}

        {/* Submit */}
        <div className="flex gap-3">
          <button
            onClick={handleUpload}
            disabled={isUploading || phase === 'done'}
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

// ── Reusable file slot sub-component ──────────────────────────────────────────

interface FileSlotProps {
  label: string
  icon: React.ReactNode
  accept: string
  file: File | null
  onPick: (e: React.ChangeEvent<HTMLInputElement>) => void
  disabled: boolean
}

function FileSlot({ label, icon, accept, file, onPick, disabled }: FileSlotProps) {
  return (
    <div>
      <p className="text-xs text-gray-400 font-semibold mb-1.5 uppercase tracking-widest">{label}</p>
      <div className={`relative border-2 border-dashed rounded-xl p-5 text-center transition-colors ${file ? 'border-brand-accent/40 bg-brand-accent/5' : 'border-white/20 hover:border-white/40'}`}>
        <input
          type="file"
          accept={accept}
          onChange={onPick}
          disabled={disabled}
          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer disabled:cursor-not-allowed"
        />
        {!file ? (
          <div className="flex flex-col items-center gap-1.5 pointer-events-none text-gray-400">
            {icon}
            <span className="text-sm font-medium">Tap to select {label.toLowerCase()}</span>
          </div>
        ) : (
          <p className="text-sm text-green-400 font-medium flex items-center justify-center gap-2 pointer-events-none">
            {icon}
            {file.name} <span className="text-gray-400">({(file.size / 1024 / 1024).toFixed(1)} MB)</span>
          </p>
        )}
      </div>
    </div>
  )
}