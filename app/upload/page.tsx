'use client'
import { useState, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { CheckCircle2, UploadCloud, Film } from 'lucide-react'

type UploadPhase = 'idle' | 'signing' | 'uploading' | 'processing' | 'done' | 'error'

export default function UploadPage() {
  const [file, setFile] = useState<File | null>(null)
  const [caption, setCaption] = useState('')
  const [phase, setPhase] = useState<UploadPhase>('idle')
  const [progress, setProgress] = useState(0)  // 0–100 during Cloudinary XHR upload
  const [error, setError] = useState('')
  const xhrRef = useRef<XMLHttpRequest | null>(null)
  const supabase = createClient()
  const router = useRouter()

  const ALLOWED_TYPES = ['video/mp4', 'video/quicktime', 'video/webm']
  const MAX_SIZE_BYTES = 100 * 1024 * 1024 // 100MB

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0] || null
    if (!selected) return
    if (!ALLOWED_TYPES.includes(selected.type)) {
      setError('Only MP4, MOV, and WebM files are supported.')
      return
    }
    if (selected.size > MAX_SIZE_BYTES) {
      setError('File must be under 100MB.')
      return
    }
    setError('')
    setPhase('idle')
    setProgress(0)
    setFile(selected)
  }

  const handleUpload = async () => {
    if (!file || !caption.trim()) return
    setError('')
    setProgress(0)

    try {
      // Step 1 — Auth
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Not authenticated')

      // Step 2 — Get Cloudinary signature
      setPhase('signing')
      const timestamp = Math.round(Date.now() / 1000)
      const folder = 'videos'

      const signRes = await fetch('/api/upload/sign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ paramsToSign: { timestamp, folder } }),
      })
      if (!signRes.ok) {
        const body = await signRes.json().catch(() => ({}))
        throw new Error(body.error || `Signing failed: ${signRes.status}`)
      }
      const { signature } = await signRes.json()

      // Step 3 — Upload to Cloudinary with XHR for progress events
      setPhase('uploading')
      const formData = new FormData()
      formData.append('file', file)
      formData.append('api_key', process.env.NEXT_PUBLIC_CLOUDINARY_API_KEY!)
      formData.append('timestamp', timestamp.toString())
      formData.append('signature', signature)
      formData.append('folder', folder)

      const cloudData = await new Promise<any>((resolve, reject) => {
        const xhr = new XMLHttpRequest()
        xhrRef.current = xhr

        xhr.upload.addEventListener('progress', (evt) => {
          if (evt.lengthComputable) {
            setProgress(Math.round((evt.loaded / evt.total) * 100))
          }
        })

        xhr.addEventListener('load', () => {
          if (xhr.status >= 200 && xhr.status < 300) {
            try { resolve(JSON.parse(xhr.responseText)) }
            catch { reject(new Error('Invalid response from Cloudinary')) }
          } else {
            reject(new Error(`Upload failed: ${xhr.status}`))
          }
        })

        xhr.addEventListener('error', () => reject(new Error('Network error during upload')))
        xhr.addEventListener('abort', () => reject(new Error('Upload cancelled')))

        xhr.open('POST', `https://api.cloudinary.com/v1_1/${process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME}/video/upload`)
        xhr.send(formData)
      })

      if (!cloudData.secure_url) throw new Error('Upload failed — no URL returned')

      // Step 4 — Save to Supabase
      setPhase('processing')
      setProgress(100)

      const { error: dbError } = await supabase.from('videos').insert({
        user_id: user.id,
        video_url: cloudData.secure_url,
        caption: caption.trim(),
        duration: cloudData.duration,
        thumbnail_url: cloudData.secure_url
          .replace('/upload/', '/upload/c_fill,f_auto,q_auto,w_400,h_533/')
          .replace(/\.[^/.]+$/, '.jpg'),
      })
      if (dbError) throw dbError

      setPhase('done')
      setTimeout(() => router.push('/'), 1500)

    } catch (e: any) {
      console.error('Upload failed:', e)
      setError(e.message || 'Upload failed. Please try again.')
      setPhase('error')
      setProgress(0)
    }
  }

  const handleCancel = () => {
    xhrRef.current?.abort()
    setPhase('idle')
    setProgress(0)
  }

  const isUploading = phase === 'signing' || phase === 'uploading' || phase === 'processing'

  const phaseLabel: Record<UploadPhase, string> = {
    idle: 'Post Video',
    signing: 'Preparing...',
    uploading: `Uploading... ${progress}%`,
    processing: 'Processing video...',
    done: 'Done! Redirecting...',
    error: 'Retry',
  }

  return (
    <div className="p-6 pt-10 text-white h-full overflow-y-auto">
      <h1 className="text-2xl font-bold mb-6 flex items-center gap-2">
        <Film size={24} className="text-brand-accent" /> Upload Video
      </h1>

      <div className="space-y-4 max-w-lg">
        {/* File picker */}
        <div className={`border-2 border-dashed rounded-xl p-6 text-center transition-colors ${file ? 'border-brand-accent/40 bg-brand-accent/5' : 'border-white/20 hover:border-white/40'}`}>
          <input
            type="file"
            accept="video/mp4,video/quicktime,video/webm"
            onChange={handleFileChange}
            disabled={isUploading}
            className="block w-full text-sm text-gray-400 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:bg-gray-800 file:text-white file:cursor-pointer cursor-pointer disabled:opacity-50"
          />
          <p className="text-xs text-gray-500 mt-2">MP4, MOV, WebM · Max 100MB</p>
          {file && (
            <p className="text-xs text-green-400 mt-2 font-medium">
              ✓ {file.name} ({(file.size / 1024 / 1024).toFixed(1)} MB)
            </p>
          )}
        </div>

        {/* Caption */}
        <textarea
          placeholder="Write a caption..."
          value={caption}
          onChange={(e) => setCaption(e.target.value)}
          disabled={isUploading}
          className="w-full bg-gray-900 border border-gray-700 rounded-xl p-3 text-white resize-none focus:outline-none focus:border-pink-500 transition-colors disabled:opacity-50"
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

        {/* Progress bar — shown during upload */}
        {(isUploading || phase === 'done') && (
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm font-medium">
              <span className="text-white/70">
                {phase === 'uploading' ? 'Uploading to cloud...' :
                  phase === 'processing' ? 'Processing video...' :
                    phase === 'done' ? 'Upload complete!' : 'Preparing...'}
              </span>
              <span className={phase === 'done' ? 'text-green-400' : 'text-brand-secondary'}>
                {phase === 'done' ? '✓' : `${progress}%`}
              </span>
            </div>

            {/* Track */}
            <div className="w-full h-2 bg-white/10 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-300 ease-out ${phase === 'done' ? 'bg-green-500' : 'bg-gradient-to-r from-brand-primary via-brand-accent to-brand-secondary'}`}
                style={{ width: `${phase === 'done' ? 100 : progress}%` }}
              />
            </div>

            {/* Large percentage — prominent for mobile */}
            {phase === 'uploading' && (
              <p className="text-center text-3xl font-black text-white tracking-tight">
                {progress}<span className="text-lg text-white/50">%</span>
              </p>
            )}

            {phase === 'done' && (
              <div className="flex items-center justify-center gap-2 text-green-400 font-bold">
                <CheckCircle2 size={18} />
                <span>Upload complete! Redirecting...</span>
              </div>
            )}
          </div>
        )}

        {/* Action buttons */}
        <div className="flex gap-3">
          <button
            onClick={handleUpload}
            disabled={isUploading || !file || !caption.trim() || phase === 'done'}
            className="flex-1 bg-gradient-to-r from-brand-primary to-brand-accent py-3 rounded-xl font-bold disabled:opacity-50 hover:opacity-90 transition-opacity flex items-center justify-center gap-2"
          >
            <UploadCloud size={18} />
            {phaseLabel[phase]}
          </button>

          {isUploading && (
            <button
              onClick={handleCancel}
              className="px-4 py-3 rounded-xl border border-white/20 text-white/70 hover:text-white hover:border-white/40 transition-colors text-sm font-medium"
            >
              Cancel
            </button>
          )}
        </div>
      </div>
    </div>
  )
}