import { MetadataRoute } from 'next'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

const SITE_URL =
    process.env.NEXT_PUBLIC_SITE_URL || 'https://serious-app-eight.vercel.app'

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
    const cookieStore = await cookies()
    const supabase = createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        {
            cookies: {
                getAll() { return cookieStore.getAll() },
                setAll() { },
            },
        }
    )

    // Fetch non-deleted videos (only id + created_at for minimal bandwidth)
    const { data: videos } = await supabase
        .from('videos')
        .select('id, created_at')
        .is('deleted_at', null)
        .order('created_at', { ascending: false })
        .limit(10_000)

    // Fetch all public profiles
    const { data: profiles } = await supabase
        .from('profiles')
        .select('id')
        .limit(10_000)

    const videoEntries: MetadataRoute.Sitemap = (videos ?? []).map(v => ({
        url: `${SITE_URL}/reel/${v.id}`,
        lastModified: new Date(v.created_at),
        changeFrequency: 'weekly',
        priority: 0.8,
    }))

    const profileEntries: MetadataRoute.Sitemap = (profiles ?? []).map(p => ({
        url: `${SITE_URL}/profile/${p.id}`,
        changeFrequency: 'weekly',
        priority: 0.6,
    }))

    return [
        { url: SITE_URL, changeFrequency: 'hourly', priority: 1.0 },
        { url: `${SITE_URL}/discover`, changeFrequency: 'hourly', priority: 0.9 },
        ...videoEntries,
        ...profileEntries,
    ]
}
