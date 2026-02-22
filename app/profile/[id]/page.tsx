'use client'
import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Profile, Video } from '@/types'
import { useParams, useRouter } from 'next/navigation'
import { toggleFollow } from '@/app/actions'
import Link from 'next/link'
import { Grid, Heart, LogOut } from 'lucide-react'

export default function ProfilePage() {
    const [profile, setProfile] = useState<Profile | null>(null)
    const [videos, setVideos] = useState<Video[]>([])
    const [followers, setFollowers] = useState(0)
    const [following, setFollowing] = useState(0)
    const [likesCount, setLikesCount] = useState(0)
    const [isFollowing, setIsFollowing] = useState(false)
    const [isSelf, setIsSelf] = useState(false)
    const [loading, setLoading] = useState(true)

    const params = useParams()
    const router = useRouter()
    const supabase = createClient()

    // Handle 'me' dynamic replacement based on currently authed user
    const fetchTargetId = async () => {
        let id = params.id as string
        const { data: { user } } = await supabase.auth.getUser()

        if (!user && id === 'me') {
            router.push('/login')
            return null
        }

        if (id === 'me') id = user!.id
        setIsSelf(user?.id === id)
        return { targetId: id, currentUserId: user?.id }
    }

    useEffect(() => {
        const loadProfile = async () => {
            const ids = await fetchTargetId()
            if (!ids) return

            const { targetId, currentUserId } = ids

            // Get profile
            let { data: profileData } = await supabase.from('profiles').select('*').eq('id', targetId).single()

            // Auto-create missing profile for manual users who skipped normal registration
            if (!profileData && targetId === currentUserId) {
                const { data: { user } } = await supabase.auth.getUser()
                if (user) {
                    const fallbackUsername = user.email ? user.email.split('@')[0] + Math.floor(Math.random() * 1000) : `user_${targetId.substring(0, 6)}`
                    const { data: newProfile } = await supabase.from('profiles').upsert({
                        id: targetId,
                        username: fallbackUsername,
                    }).select().single()
                    profileData = newProfile
                }
            }

            if (profileData) setProfile(profileData)

            // Get videos
            const { data: videosData } = await supabase.from('videos').select('*').eq('user_id', targetId).order('created_at', { ascending: false })
            if (videosData) {
                setVideos(videosData as Video[])
                const totalLikes = videosData.reduce((acc, v) => acc + (v.likes_count || 0), 0)
                setLikesCount(totalLikes)
            }

            // Get followers
            const { count: followerCount } = await supabase.from('followers').select('*', { count: 'exact', head: true }).eq('following_id', targetId)
            setFollowers(followerCount || 0)

            // Get following
            const { count: followingCount } = await supabase.from('followers').select('*', { count: 'exact', head: true }).eq('follower_id', targetId)
            setFollowing(followingCount || 0)

            // Make sure we stop loading early if the profile does not exist for an external user
            if (!profileData) {
                setLoading(false)
                return
            }

            // Check if following
            if (currentUserId && !isSelf) {
                const { data: followStatus } = await supabase.from('followers').select('follower_id').eq('follower_id', currentUserId).eq('following_id', targetId).single()
                if (followStatus) setIsFollowing(true)
            }

            setLoading(false)
        }

        loadProfile()
    }, [params.id])

    const handleFollowChange = async () => {
        if (!profile) return
        setIsFollowing(!isFollowing)
        setFollowers(prev => isFollowing ? prev - 1 : prev + 1)

        const result = await toggleFollow(profile.id)
        if (result && !result.success) {
            // Revert optimistic if error
            setIsFollowing(!isFollowing)
            setFollowers(prev => isFollowing ? prev + 1 : prev - 1)
        }
    }

    const handleLogout = async () => {
        await supabase.auth.signOut()
        router.push('/login')
    }

    if (loading) return (
        <div className="min-h-screen bg-black flex items-center justify-center">
            <div className="animate-spin rounded-full h-8 w-8 border-2 border-brand-accent border-t-transparent" />
        </div>
    )

    if (!profile) return <div className="min-h-screen text-white bg-black p-10 text-center">Profile not found</div>

    return (
        <div className="min-h-screen bg-black text-white pt-safe pb-20 md:pb-0 overflow-y-auto">

            {/* Header */}
            <div className="sticky top-0 bg-black/80 backdrop-blur-md p-4 flex justify-between items-center z-10">
                <h1 className="text-xl font-bold mx-auto">{profile.username}</h1>
                {isSelf && (
                    <button onClick={handleLogout} className="absolute right-4 top-4 text-gray-400 hover:text-white">
                        <LogOut size={24} />
                    </button>
                )}
            </div>

            <div className="max-w-xl mx-auto flex flex-col items-center px-4 pt-6 pb-2 border-b border-gray-900">
                {/* Avatar */}
                <div className="w-24 h-24 rounded-full overflow-hidden bg-gray-800 border-[3px] border-gray-700 mb-4">
                    {profile.avatar_url ? (
                        <img src={profile.avatar_url} alt="" className="w-full h-full object-cover" />
                    ) : (
                        <div className="w-full h-full bg-gradient-to-tr from-brand-secondary to-brand-primary" />
                    )}
                </div>

                <h2 className="font-bold text-lg">@{profile.username}</h2>
                {profile.full_name && <p className="text-gray-400 text-sm mt-1">{profile.full_name}</p>}

                {/* Stats */}
                <div className="flex gap-8 mt-6 w-full justify-center">
                    <div className="flex flex-col items-center">
                        <span className="font-bold text-lg">{following}</span>
                        <span className="text-sm text-gray-400">Following</span>
                    </div>
                    <div className="flex flex-col items-center cursor-pointer">
                        <span className="font-bold text-lg">{followers}</span>
                        <span className="text-sm text-gray-400">Followers</span>
                    </div>
                    <div className="flex flex-col items-center">
                        <span className="font-bold text-lg">{likesCount}</span>
                        <span className="text-sm text-gray-400">Likes</span>
                    </div>
                </div>

                {/* Action Buttons */}
                <div className="mt-6 w-full flex justify-center pb-4">
                    {isSelf ? (
                        <Link href="/profile/edit" className="px-12 py-3 bg-gray-800 font-semibold rounded-lg hover:bg-gray-700 transition w-full text-center">
                            Edit profile
                        </Link>
                    ) : (
                        <button
                            onClick={handleFollowChange}
                            className={`px-12 py-3 font-semibold rounded-lg transition w-full tracking-wide ${isFollowing ? 'bg-gray-800 text-white' : 'bg-brand-accent text-white'}`}
                        >
                            {isFollowing ? 'Following' : 'Follow'}
                        </button>
                    )}
                </div>

                {profile.bio && (
                    <p className="mt-2 mb-4 text-center text-sm px-4">{profile.bio}</p>
                )}
            </div>

            {/* Grid Tabs */}
            <div className="flex text-center border-b border-gray-900 max-w-xl mx-auto">
                <div className="flex-1 py-3 border-b-2 border-white flex justify-center text-white">
                    <Grid size={24} />
                </div>
                <div className="flex-1 py-3 text-gray-500 flex justify-center">
                    <Heart size={24} />
                </div>
            </div>

            {/* Videos Grid */}
            <div className="grid grid-cols-3 gap-[1px] max-w-xl mx-auto">
                {videos.map((video) => (
                    <Link href={`/?v=${video.id}`} key={video.id} className="relative aspect-[3/4] bg-gray-900 group">
                        <video src={video.video_url} className="w-full h-full object-cover" muted playsInline />
                        <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity" />
                        <div className="absolute bottom-1 left-2 flex items-center gap-1 text-white text-xs font-bold drop-shadow-md">
                            <svg className="w-3 h-3 stroke-white fill-transparent" viewBox="0 0 24 24" strokeWidth="2"><path d="m2 12 5.25 5L22 4"></path></svg>
                            {video.view_count || 0}
                        </div>
                    </Link>
                ))}
                {videos.length === 0 && (
                    <div className="col-span-3 text-center text-gray-500 py-20">
                        No videos yet
                    </div>
                )}
            </div>

        </div>
    )
}
