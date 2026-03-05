/**
 * Helper utilities to optimize Cloudinary URLs to save bandwidth.
 */

export function getOptimizedVideoUrl(url: string | null | undefined): string {
    if (!url) return '';
    if (!url.includes('cloudinary.com')) return url;
    return url.replace('/upload/', '/upload/f_auto,q_auto,c_limit,w_720/');
}

export function getOptimizedPosterUrl(url: string | null | undefined): string {
    if (!url) return '';
    if (!url.includes('cloudinary.com')) return url;
    let optimizedUrl = url.replace('/upload/', '/upload/e_blur:200,f_auto,q_auto,w_400/');
    optimizedUrl = optimizedUrl.replace(/\.[^/.]+$/, '.jpg');
    return optimizedUrl;
}

/**
 * Sharp (no blur) thumbnail for grid displays in profile and discover pages.
 * Uses next/image with remotePatterns so this MUST be a Cloudinary URL.
 */
export function getThumbnailUrl(url: string | null | undefined): string {
    if (!url) return '';
    if (!url.includes('cloudinary.com')) return url;
    // c_fill for consistent grid aspect ratio, w_400 for mobile, format auto
    let thumbUrl = url.replace('/upload/', '/upload/c_fill,f_auto,q_auto,w_400,h_533/');
    thumbUrl = thumbUrl.replace(/\.[^/.]+$/, '.jpg');
    return thumbUrl;
}

/**
 * Face-aware avatar optimization.
 */
export function getAvatarUrl(url: string | null | undefined, size = 200): string {
    if (!url) return '';
    if (!url.includes('cloudinary.com')) return url;
    return url.replace('/upload/', `/upload/c_fill,f_auto,q_auto,g_face,w_${size},h_${size}/`);
}

