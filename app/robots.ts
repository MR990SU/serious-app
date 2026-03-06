import { MetadataRoute } from 'next'

const SITE_URL =
    process.env.NEXT_PUBLIC_SITE_URL || 'https://serious-app-eight.vercel.app'

export default function robots(): MetadataRoute.Robots {
    return {
        rules: [
            {
                userAgent: '*',
                allow: '/',
                // Disallow internal auth routes from indexing
                disallow: ['/auth/', '/api/'],
            },
        ],
        sitemap: `${SITE_URL}/sitemap.xml`,
    }
}
