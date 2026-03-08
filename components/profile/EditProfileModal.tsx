'use client'

import { useState, useRef } from 'react'
import { X, Upload, Loader2, Image as ImageIcon } from 'lucide-react'
import { updateProfile } from '@/app/actions/profile-actions'
import { useRouter } from 'next/navigation'

interface EditProfileModalProps {
    isOpen: boolean
    onClose: () => void
    currentBio: string | null
    currentAvatar: string | null
}

export function EditProfileModal({ isOpen, onClose, currentBio, currentAvatar }: EditProfileModalProps) {
    const [bio, setBio] = useState(currentBio || '')
    const [avatarFile, setAvatarFile] = useState<File | null>(null)
    const [previewUrl, setPreviewUrl] = useState<string | null>(currentAvatar)
    const [isLoading, setIsLoading] = useState(false)
    const [error, setError] = useState('')
    const fileInputRef = useRef<HTMLInputElement>(null)
    const router = useRouter()

    if (!isOpen) return null

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
        if (!file) return

        if (file.size > 5 * 1024 * 1024) {
            setError('Image must be less than 5MB')
            return
        }

        if (!file.type.startsWith('image/')) {
            setError('File must be an image')
            return
        }

        setError('')
        setAvatarFile(file)

        // Create local preview
        const reader = new FileReader()
        reader.onloadend = () => {
            setPreviewUrl(reader.result as string)
        }
        reader.readAsDataURL(file)
    }

    const uploadToCloudinary = async (file: File) => {
        // 1. Get Signature
        const timestamp = Math.round(Date.now() / 1000)
        const folder = 'avatars'

        const signResponse = await fetch('/api/upload/sign', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ paramsToSign: { timestamp, folder } })
        })

        if (!signResponse.ok) throw new Error('Failed to get upload signature')
        const { signature, resource_type: resourceType = 'image' } = await signResponse.json()

        // 2. Upload to Cloudinary
        const formData = new FormData()
        formData.append('file', file)
        formData.append('api_key', process.env.NEXT_PUBLIC_CLOUDINARY_API_KEY!)
        formData.append('timestamp', timestamp.toString())
        formData.append('signature', signature)
        formData.append('folder', folder)

        formData.append('resource_type', resourceType)
        const uploadResponse = await fetch(
            `https://api.cloudinary.com/v1_1/${process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME}/${resourceType}/upload`,
            { method: 'POST', body: formData }
        )

        if (!uploadResponse.ok) throw new Error('Failed to upload image')
        const data = await uploadResponse.json()
        return { secure_url: data.secure_url, public_id: data.public_id }
    }

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        setIsLoading(true)
        setError('')

        try {
            let newAvatarUrl = currentAvatar
            let uploadedPublicId = null

            // Only upload to Cloudinary if a new file was selected
            if (avatarFile) {
                const uploadResult = await uploadToCloudinary(avatarFile)
                newAvatarUrl = uploadResult.secure_url
                uploadedPublicId = uploadResult.public_id
            }

            // Secure Server Action update
            const result = await updateProfile(newAvatarUrl, bio)

            if (!result.success) {
                // Rollback: delete the newly uploaded image from Cloudinary to prevent orphans
                if (uploadedPublicId) {
                    const { deleteCloudinaryImage } = await import('@/app/actions/profile-actions')
                    await deleteCloudinaryImage(uploadedPublicId)
                }
                throw new Error(result.error || 'Failed to update profile')
            }

            // Success! Refresh the page so the new data renders instantly
            router.refresh()
            onClose()

        } catch (err: any) {
            setError(err.message || 'An error occurred during save')
        } finally {
            setIsLoading(false)
        }
    }

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
            <div className="w-full max-w-md bg-gray-900 border border-white/10 rounded-2xl overflow-hidden shadow-2xl animate-in fade-in zoom-in-95 duration-200">
                {/* Header */}
                <div className="flex justify-between items-center p-4 border-b border-white/10">
                    <h2 className="text-xl font-bold text-white">Edit Profile</h2>
                    <button
                        onClick={onClose}
                        disabled={isLoading}
                        className="p-1 rounded-full hover:bg-white/10 text-gray-400 hover:text-white transition"
                    >
                        <X size={24} />
                    </button>
                </div>

                {/* Body Form */}
                <form onSubmit={handleSubmit} className="p-4 flex flex-col gap-6">
                    {/* Display Error Message */}
                    {error && (
                        <div className="bg-red-500/10 border border-red-500/50 text-red-500 text-sm px-4 py-3 rounded-xl font-medium">
                            {error}
                        </div>
                    )}

                    {/* Avatar Upload */}
                    <div className="flex flex-col items-center gap-4">
                        <div
                            className="relative w-28 h-28 rounded-full overflow-hidden border-2 border-dashed border-gray-600 hover:border-brand-secondary transition-colors cursor-pointer group bg-black"
                            onClick={() => fileInputRef.current?.click()}
                        >
                            {previewUrl ? (
                                <>
                                    <img src={previewUrl} alt="Preview" className="w-full h-full object-cover" />
                                    <div className="absolute inset-0 bg-black/50 flex flex-col items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                        <Upload size={24} className="text-white mb-1" />
                                        <span className="text-xs font-bold text-white">Change</span>
                                    </div>
                                </>
                            ) : (
                                <div className="absolute inset-0 flex flex-col items-center justify-center text-gray-400 hover:text-brand-secondary">
                                    <ImageIcon size={32} className="mb-2" />
                                    <span className="text-xs font-bold">Upload</span>
                                </div>
                            )}
                        </div>
                        <input
                            type="file"
                            ref={fileInputRef}
                            onChange={handleFileChange}
                            accept="image/png, image/jpeg, image/webp"
                            className="hidden"
                        />
                        <p className="text-xs text-gray-500">Requirements: JPG, PNG, WEBP (Max 5MB)</p>
                    </div>

                    {/* Bio Field */}
                    <div className="flex flex-col gap-2">
                        <label htmlFor="bio" className="text-sm font-semibold text-gray-300 ml-1">
                            Bio
                        </label>
                        <textarea
                            id="bio"
                            value={bio}
                            onChange={(e) => setBio(e.target.value)}
                            placeholder="Tell everyone a little about yourself..."
                            className="w-full bg-black/50 border border-white/10 rounded-xl p-3 text-white placeholder-gray-600 focus:outline-none focus:border-brand-secondary focus:ring-1 focus:ring-brand-secondary transition-all resize-none h-24"
                            maxLength={150}
                        />
                        <div className="text-right text-xs text-gray-500 mr-1 font-medium">
                            {bio.length} / 150
                        </div>
                    </div>

                    {/* Submit Button */}
                    <button
                        type="submit"
                        disabled={isLoading}
                        className="w-full py-3.5 bg-brand-accent hover:bg-brand-secondary text-white font-bold rounded-xl transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                    >
                        {isLoading ? (
                            <>
                                <Loader2 className="animate-spin" size={20} />
                                Saving Changes...
                            </>
                        ) : (
                            'Save Profile'
                        )}
                    </button>
                </form>
            </div>
        </div>
    )
}
