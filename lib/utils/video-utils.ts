/**
 * Helper utilities to optimize Cloudinary URLs to save bandwidth.
 */

export function getOptimizedVideoUrl(url: string | null | undefined): string {
    if (!url) return '';
    if (!url.includes('cloudinary.com')) return url;

    // Insert f_auto,q_auto,c_limit,w_720 after /upload/
    return url.replace('/upload/', '/upload/f_auto,q_auto,c_limit,w_720/');
}

export function getOptimizedPosterUrl(url: string | null | undefined): string {
    if (!url) return '';
    if (!url.includes('cloudinary.com')) return url;

    // 1. Insert transformations: e_blur:200,f_auto,q_auto,w_400
    // 2. Change extension from .mp4 (or others) to .jpg
    let optimizedUrl = url.replace('/upload/', '/upload/e_blur:200,f_auto,q_auto,w_400/');

    // Replace file extension with .jpg (handling .mp4, .webm, .mov, etc)
    optimizedUrl = optimizedUrl.replace(/\.[^/.]+$/, ".jpg");

    return optimizedUrl;
}
