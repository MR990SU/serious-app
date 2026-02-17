'use client'
import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

export default function UploadPage() {
  const [file, setFile] = useState<File | null>(null)
  const [caption, setCaption] = useState('')
  const [uploading, setUploading] = useState(false)
  const supabase = createClient()
  const router = useRouter()

  /*const handleUpload = async () => {
    if (!file || !caption) return
    setUploading(true)

    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error("Not authenticated")

      // 1. Get Signature
      const timestamp = Math.round(new Date().getTime() / 1000)
      const folder = 'videos'
      
      const signRes = await fetch('/api/upload/sign', {
        method: 'POST',
        body: JSON.stringify({ paramsToSign: { timestamp, folder } })
      })
      const { signature } = await signRes.json()

      // 2. Upload to Cloudinary
      const formData = new FormData()
      formData.append('file', file)
      formData.append('api_key', process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME!)
      formData.append('timestamp', timestamp.toString())
      formData.append('signature', signature)
      formData.append('folder', folder)

      const uploadRes = await fetch(`https://api.cloudinary.com/v1_1/${process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME}/video/upload`, {
        method: 'POST',
        body: formData
      })
      const cloudData = await uploadRes.json()

      // 3. Save to Supabase
      const { error } = await supabase.from('videos').insert({
        user_id: user.id,
        video_url: cloudData.secure_url,
        caption: caption,
        duration: cloudData.duration
      })

      if (error) throw error

      router.push('/')
    } catch (e) {
      alert('Upload failed')
      console.error(e)
    } finally {
      setUploading(false)
    }
  }*/
  const handleUpload = async () => {
  if (!file || !caption) return
  setUploading(true)

  try {
    const { data } = await supabase.auth.getSession()
    const user = data.session?.user
    if (!user) throw new Error("Not authenticated")

    const timestamp = Math.round(Date.now() / 1000)
    const folder = 'videos'

    const signRes = await fetch('/api/upload/sign', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ paramsToSign: { timestamp, folder } })
    })

    const { signature } = await signRes.json()

    const formData = new FormData()
    formData.append('file', file)
    formData.append('api_key', process.env.NEXT_PUBLIC_CLOUDINARY_API_KEY!)
    formData.append('timestamp', timestamp.toString())
    formData.append('signature', signature)
    formData.append('folder', folder)

    const uploadRes = await fetch(
      `https://api.cloudinary.com/v1_1/${process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME}/video/upload`,
      {
        method: 'POST',
        body: formData
      }
    )

    if (!uploadRes.ok) {
      throw new Error(await uploadRes.text())
    }

    const cloudData = await uploadRes.json()

    if (!cloudData.secure_url) {
      throw new Error("Upload failed")
    }

    const { error } = await supabase.from('videos').insert({
      user_id: user.id,
      video_url: cloudData.secure_url,
      caption,
      duration: cloudData.duration
    })

    if (error) throw error

    router.push('/')

  } catch (e) {
    console.error(e)
    alert('Upload failed')
  } finally {
    setUploading(false)
  }
}

  return (
    <div className="p-6 pt-10 text-white h-full">
      <h1 className="text-2xl font-bold mb-6">Upload Video</h1>
      
      <div className="space-y-4">
        <input 
          type="file" 
          accept="video/mp4" 
          onChange={(e) => setFile(e.target.files?.[0] || null)}
          className="block w-full text-sm text-gray-400 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:bg-gray-800 file:text-white"
        />
        
        <textarea
          placeholder="Caption..."
          value={caption}
          onChange={(e) => setCaption(e.target.value)}
          className="w-full bg-gray-900 border border-gray-700 rounded p-3 text-white"
          rows={3}
        />

        <button 
          onClick={handleUpload} 
          disabled={uploading || !file}
          className="w-full bg-pink-600 py-3 rounded-lg font-bold disabled:opacity-50"
        >
          {uploading ? 'Uploading...' : 'Post Video'}
        </button>
      </div>
    </div>
  )
}