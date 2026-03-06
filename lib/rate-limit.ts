/**
 * In-memory rate limiter for server actions.
 *
 * Limitations: Resets on cold starts (Vercel serverless).
 * This is best-effort protection. For hard enforcement consider
 * Upstash Redis (free tier available) via the `@upstash/ratelimit` package.
 *
 * Usage:
 *   const limited = isRateLimited(userId, 'toggleLike', 30, 60_000)
 *   if (limited) return { success: false, error: 'Too many requests' }
 */

interface RateLimitEntry {
    count: number
    resetAt: number
}

// Keyed by `${userId}:${action}`
const store = new Map<string, RateLimitEntry>()

// Prune stale entries to prevent unbounded memory growth.
// Called on every check so no background job is needed.
function prune() {
    const now = Date.now()
    store.forEach((entry, key) => {
        if (now > entry.resetAt) store.delete(key)
    })
}

/**
 * Returns true if the caller has exceeded the allowed rate.
 * @param identifier  User ID or IP string
 * @param action      Unique action name (e.g. 'toggleLike')
 * @param limit       Maximum requests allowed within windowMs
 * @param windowMs    Rolling window in milliseconds
 */
export function isRateLimited(
    identifier: string,
    action: string,
    limit: number,
    windowMs: number
): boolean {
    prune()

    const key = `${identifier}:${action}`
    const now = Date.now()
    const entry = store.get(key)

    if (!entry || now > entry.resetAt) {
        store.set(key, { count: 1, resetAt: now + windowMs })
        return false
    }

    if (entry.count >= limit) return true

    entry.count++
    return false
}
