'use client'
import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Profile, Video } from '@/types'
import { useParams, useRouter, useSearchParams } from 'next/navigation'
import { toggleFollow } from '@/app/actions/profile-actions'
import Image from 'next/image'
import Link from 'next/link'
import { Grid, Heart, LogOut, Bookmark, Music } from 'lucide-react'
import { EditProfileModal } from '@/components/profile/EditProfileModal'
import { ProfilePostViewer } from '@/components/profile/ProfilePostViewer'
import { getThumbnailUrl } from '@/lib/utils/video-utils'
import { ClickableAvatar } from '@/components/profile/ClickableAvatar'
import { PostCard } from '@/components/feed/PostCard'

export default function ProfilePage() {
    const [profile, setProfile] = useState<Profile | null>(null)
    const [videos, setVideos] = useState<Video[]>([])
    const [followers, setFollowers] = useState(0)
    const [following, setFollowing] = useState(0)
    const [likesCount, setLikesCount] = useState(0)
    const [isFollowing, setIsFollowing] = useState(false)
    const [isSelf, setIsSelf] = useState(false)
    const [loading, setLoading] = useState(true)
    const [isEditModalOpen, setIsEditModalOpen] = useState(false)

    // Tab & Lazy-Load Caches
    const [activeTab, setActiveTab] = useState<'reels' | 'liked' | 'saved' | 'audio'>('reels')
    const [reelsCache, setReelsCache] = useState<Video[]>([])
    const [likedCache, setLikedCache] = useState<Video[]>([])
    const [savedCache, setSavedCache] = useState<Video[]>([])
    const [audioCache, setAudioCache] = useState<any[]>([])

    const [tabLoading, setTabLoading] = useState(false)

    const params = useParams()
    const router = useRouter()
    const searchParams = useSearchParams()
    const supabase = createClient()

    // ── Modal state driven by URL ?v= param ──────────────────────
    const activeVideoId = searchParams.get('v')

    // The active video for the modal could come from any of the video caches
    const allVideos = [...reelsCache, ...likedCache, ...savedCache]
    const activeVideoIndex = allVideos.findIndex(v => v.id === activeVideoId)
    const activeVideo = activeVideoIndex >= 0 ? allVideos[activeVideoIndex] : null

    const openVideoModal = useCallback((video: Video) => {
        router.push(`?v=${video.id}`, { scroll: false })
    }, [router])

    const closeVideoModal = useCallback(() => {
        router.back()
    }, [router])

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

            // Fetch profile and initial stats
            const [profileRes, followerRes, followingRes] = await Promise.all([
                supabase.from('profiles').select('*').eq('id', targetId).single(),
                supabase.from('followers').select('follower_id', { count: 'exact', head: true }).eq('following_id', targetId),
                supabase.from('followers').select('following_id', { count: 'exact', head: true }).eq('follower_id', targetId),
            ])

            let profileData = profileRes.data

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

            // Calculate total likes via an aggregate query since we aren't fetching all videos eagerly anymore
            const { data: likeStats } = await supabase.from('videos').select('likes_count').eq('user_id', targetId).is('deleted_at', null)
            if (likeStats) {
                const totalLikes = likeStats.reduce((acc, v) => acc + (v.likes_count || 0), 0)
                setLikesCount(totalLikes)
            }

            setFollowers(followerRes.count || 0)
            setFollowing(followingRes.count || 0)

            // Stop early if profile does not exist for an external user
            if (!profileData) {
                setLoading(false)
                return
            }

            // Follow-status check: runs after parallel batch since it needs currentUserId
            if (currentUserId && !isSelf) {
                const { data: followStatus } = await supabase.from('followers').select('follower_id').eq('follower_id', currentUserId).eq('following_id', targetId).single()
                if (followStatus) setIsFollowing(true)
            }

            setLoading(false)
        }

        loadProfile()
    }, [params.id, supabase])

    // ── Lazy Loading Tabs ────────────────────────────────────────────────────

    useEffect(() => {
        if (!profile) return

        const fetchTabCache = async () => {
            setTabLoading(true)

            try {
                if (activeTab === 'reels' && reelsCache.length === 0) {
                    const { data } = await supabase.from('videos')
                        .select('*, users:profiles(id, username, avatar_url)')
                        .eq('user_id', profile.id).is('deleted_at', null)
                        .order('created_at', { ascending: false }).limit(12)

                    if (data) setReelsCache(data.map((v: any) => ({ ...v, users: Array.isArray(v.users) ? v.users[0] : v.users })))
                }
                else if (activeTab === 'liked' && likedCache.length === 0) {
                    const res = await fetch('/api/reels/liked')
                    const data = await res.json()
                    if (data.posts) setLikedCache(data.posts)
                }
                else if (activeTab === 'saved' && savedCache.length === 0) {
                    const res = await fetch('/api/reels/saved')
                    const data = await res.json()
                    if (data.posts) setSavedCache(data.posts)
                }
                else if (activeTab === 'audio' && audioCache.length === 0) {
                    const res = await fetch('/api/audio/saved')
                    const data = await res.json()
                    if (data.audio) setAudioCache(data.audio)
                }
            } catch (e) {
                console.error('Failed to load tab:', e)
            } finally {
                setTabLoading(false)
            }
        }

        fetchTabCache()

    }, [activeTab, profile, reelsCache.length, likedCache.length, savedCache.length, audioCache.length, supabase])

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
        <div className="h-full bg-black text-white pt-safe pb-20 md:pb-0 overflow-y-auto">

            {/* Header */}
            {isSelf && (
                <div className="sticky top-0 bg-transparent flex justify-end p-4 z-10 pointer-events-none">
                    <button onClick={handleLogout} className="text-gray-400 hover:text-white pointer-events-auto bg-black/50 p-2 rounded-full backdrop-blur-md">
                        <LogOut size={24} />
                    </button>
                </div>
            )}

            <div className={`max-w-xl mx-auto flex flex-col items-center px-4 mb-4 ${isSelf ? 'pt-0' : 'pt-10'}`}>
                {/* Avatar */}
                <div className="w-24 h-24 rounded-full overflow-hidden bg-gray-800 border-[3px] border-gray-700 mb-4">
                    <ClickableAvatar src={profile.avatar_url || null} username={profile.username} className="w-full h-full" />
                </div>

                <h2 className="font-bold text-lg">@{profile.username}</h2>
                {profile.full_name && <p className="text-gray-400 text-sm mt-1">{profile.full_name}</p>}

                {profile.bio && (
                    <p className="mt-3 mb-1 text-center text-sm px-4 max-w-sm whitespace-pre-wrap">{profile.bio}</p>
                )}

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
                        <button onClick={() => setIsEditModalOpen(true)} className="px-12 py-3 bg-gray-800 font-semibold rounded-lg hover:bg-gray-700 transition w-full text-center">
                            Edit profile
                        </button>
                    ) : (
                        <button
                            onClick={handleFollowChange}
                            className={`px-12 py-3 font-semibold rounded-lg transition w-full tracking-wide ${isFollowing ? 'bg-gray-800 text-white' : 'bg-brand-accent text-white'}`}
                        >
                            {isFollowing ? 'Following' : 'Follow'}
                        </button>
                    )}
                </div>

            </div>

            {/* Grid Tabs */}
            <div className="flex text-center border-b border-gray-900 max-w-xl mx-auto">
                <button
                    onClick={() => setActiveTab('reels')}
                    className={`flex-1 py-3 border-b-2 flex justify-center transition-colors ${activeTab === 'reels' ? 'border-white text-white' : 'border-transparent text-gray-500 hover:text-gray-300'}`}
                >
                    <Grid size={24} />
                </button>
                <button
                    onClick={() => setActiveTab('liked')}
                    className={`flex-1 py-3 border-b-2 flex justify-center transition-colors ${activeTab === 'liked' ? 'border-white text-white' : 'border-transparent text-gray-500 hover:text-gray-300'}`}
                >
                    <Heart size={24} />
                </button>

                {isSelf && (
                    <>
                        <button
                            onClick={() => setActiveTab('saved')}
                            className={`flex-1 py-3 border-b-2 flex justify-center transition-colors ${activeTab === 'saved' ? 'border-white text-white' : 'border-transparent text-gray-500 hover:text-gray-300'}`}
                        >
                            <Bookmark size={24} />
                        </button>
                        <button
                            onClick={() => setActiveTab('audio')}
                            className={`flex-1 py-3 border-b-2 flex justify-center transition-colors ${activeTab === 'audio' ? 'border-white text-white' : 'border-transparent text-gray-500 hover:text-gray-300'}`}
                        >
                            <Music size={24} />
                        </button>
                    </>
                )}
            </div>

            {/* Grids */}
            <div className="max-w-xl mx-auto bg-black pb-24 md:pb-4 min-h-[50vh]">

                {tabLoading && (
                    <div className="flex justify-center py-20">
                        <div className="animate-spin rounded-full h-8 w-8 border-2 border-brand-accent border-t-transparent" />
                    </div>
                )}

                {/* Video Grids (Reels, Liked, Saved) */}
                {!tabLoading && activeTab !== 'audio' && (
                    <div className="grid grid-cols-3 gap-[1px]">
                        {(() => {
                            const gridData = activeTab === 'reels' ? reelsCache
                                : activeTab === 'liked' ? likedCache
                                    : savedCache;

                            if (gridData.length === 0) {
                                return (
                                    <div className="col-span-3 text-center text-gray-500 py-20">
                                        No videos found
                                    </div>
                                )
                            }

                            return gridData.map((video) => {
                                const thumbSource = video.thumbnail_url || (video.video_url.includes('cloudinary.com')
                                    ? video.video_url.replace('/upload/', '/upload/c_fill,f_auto,q_auto,w_400,h_533/').replace(/\.[^/.]+$/, '.jpg')
                                    : video.video_url);

                                return (
                                    <PostCard
                                        key={video.id}
                                        video={video}
                                        onClick={() => openVideoModal(video)}
                                        className="col-span-1 row-span-1 min-h-[150px] md:min-h-[200px]"
                                    />
                                )
                            })
                        })()}
                    </div>
                )}

                {/* Audio Grid */}
                {!tabLoading && activeTab === 'audio' && (
                    <div className="p-4 space-y-4">
                        {audioCache.length === 0 ? (
                            <div className="text-center text-gray-500 py-20">
                                No saved audio
                            </div>
                        ) : (
                            audioCache.map(audio => (
                                <Link
                                    key={audio.id}
                                    href={`/audio/${audio.id}`}
                                    prefetch
                                    className="flex items-center justify-between p-3 rounded-xl hover:bg-gray-900 border border-transparent hover:border-gray-800 transition-colors group"
                                >
                                    <div className="flex items-center gap-4">
                                        <div className="w-12 h-12 rounded-full bg-gradient-to-tr from-gray-800 to-gray-900 flex items-center justify-center shadow-lg relative overflow-hidden flex-shrink-0 group-hover:scale-105 transition-transform">
                                            <Music size={20} className="text-gray-400" />
                                        </div>
                                        <div className="overflow-hidden">
                                            <p className="font-bold text-white truncate max-w-[200px] sm:max-w-[300px]">{audio.title}</p>
                                            <p className="text-sm text-gray-400 truncate max-w-[200px] sm:max-w-[300px]">{audio.artist}</p>
                                        </div>
                                    </div>
                                    <div className="text-xs font-bold text-gray-500 bg-gray-900 px-3 py-1.5 rounded-full whitespace-nowrap">
                                        {audio.used_count.toLocaleString()} posts
                                    </div>
                                </Link>
                            ))
                        )}
                    </div>
                )}
            </div>

            <EditProfileModal
                isOpen={isEditModalOpen}
                onClose={() => setIsEditModalOpen(false)}
                currentBio={profile.bio || ''}
                currentAvatar={profile.avatar_url || null}
            />

            {/* Profile Post Viewer */}
            {activeVideo && activeVideoIndex >= 0 && (
                <ProfilePostViewer
                    posts={activeTab === 'reels' ? reelsCache : activeTab === 'liked' ? likedCache : savedCache}
                    startIndex={activeTab === 'reels' ? reelsCache.findIndex(v => v.id === activeVideoId) :
                        activeTab === 'liked' ? likedCache.findIndex(v => v.id === activeVideoId) :
                            savedCache.findIndex(v => v.id === activeVideoId)}
                    onClose={closeVideoModal}
                />
            )}
        </div>
    )
}
