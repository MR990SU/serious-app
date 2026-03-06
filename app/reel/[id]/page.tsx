import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { notFound } from 'next/navigation'
import { getThumbnailUrl } from '@/lib/utils/video-utils'
import ReelPageClient from './ReelPageClient'
import type { Metadata } from 'next'

const SITE_URL =
    process.env.NEXT_PUBLIC_SITE_URL || 'https://serious-app-eight.vercel.app'

async function getVideo(id: string) {
    const cookieStore = await cookies()
    const supabase = createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        { cookies: { getAll: () => cookieStore.getAll(), setAll: () => { } } }
    )

    const { data, error } = await supabase
        .from('videos')
        .select('*, users:profiles!user_id(id, username, avatar_url, full_name)')
        .eq('id', id)
        .is('deleted_at', null)
        .single()

    if (error || !data) return null

    // Normalize joined array (Supabase sometimes wraps in array)
    return { ...data, users: Array.isArray(data.users) ? data.users[0] : data.users }
}

// ── Dynamic metadata ────────────────────────────────────────────────────────
export async function generateMetadata(
    { params }: { params: { id: string } }
): Promise<Metadata> {
    const video = await getVideo(params.id)
    if (!video) return { title: 'Reel not found | Verve' }

    const thumbnail = video.thumbnail_url || getThumbnailUrl(video.video_url)
    const description = video.caption
        ? `${video.caption.slice(0, 150)}${video.caption.length > 150 ? '…' : ''}`
        : `Watch @${video.users?.username}'s reel on Verve`

    return {
        title: `@${video.users?.username} on Verve`,
        description,
        openGraph: {
            title: `@${video.users?.username} on Verve`,
            description,
            type: 'video.other',
            videos: [{ url: video.video_url, width: 1080, height: 1920 }],
            images: [{ url: thumbnail, width: 1080, height: 1920 }],
        },
        twitter: {
            card: 'player',
            title: `@${video.users?.username} on Verve`,
            description,
            images: [thumbnail],
        },
    }
}

// ── Page component (server) ──────────────────────────────────────────────────
export default async function ReelPage({ params }: { params: { id: string } }) {
    const video = await getVideo(params.id)
    if (!video) notFound()

    const thumbnail = video.thumbnail_url || getThumbnailUrl(video.video_url)

    // VideoObject JSON-LD schema for Google rich results
    const jsonLd = {
        '@context': 'https://schema.org',
        '@type': 'VideoObject',
        name: video.caption || `Video by @${video.users?.username}`,
        description: video.caption || `A reel by @${video.users?.username} on Verve`,
        thumbnailUrl: thumbnail,
        uploadDate: video.created_at,
        contentUrl: video.video_url,
        embedUrl: `${SITE_URL}/reel/${video.id}`,
        interactionStatistic: [
            {
                '@type': 'InteractionCounter',
                interactionType: 'https://schema.org/WatchAction',
                userInteractionCount: video.view_count || 0,
            },
            {
                '@type': 'InteractionCounter',
                interactionType: 'https://schema.org/LikeAction',
                userInteractionCount: video.likes_count || 0,
            },
        ],
        author: {
            '@type': 'Person',
            name: video.users?.full_name || video.users?.username,
            url: `${SITE_URL}/profile/${video.users?.id}`,
        },
    }

    return (
        <>
            <script
                type="application/ld+json"
                dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
            />
            <ReelPageClient video={video} />
        </>
    )
}
