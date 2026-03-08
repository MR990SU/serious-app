import { v2 as cloudinary } from 'cloudinary'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextRequest } from 'next/server'

cloudinary.config({
  cloud_name: process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME,
  api_key: process.env.NEXT_PUBLIC_CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
})

const ALLOWED_FOLDERS = new Set(['videos', 'avatars'])

/**
 * Resource type enforcement map — injected server-side, cannot be overridden by client.
 * Values align with Cloudinary's expected `resource_type` and `allowed_formats` params.
 */
const FOLDER_CONSTRAINTS: Record<string, { resource_type: string; allowed_formats: string }> = {
  videos: { resource_type: 'video', allowed_formats: 'mp4,mov,webm' },
  avatars: { resource_type: 'image', allowed_formats: 'jpg,jpeg,png,webp' },
}

// Simple Map-based rate limiter with TTL.
// On Vercel serverless each invocation may share cold lambda memory between
// requests in a warm window, so this provides best-effort rate limiting.
const rateLimitMap = new Map<string, { count: number; resetAt: number }>()
const RATE_LIMIT = 5
const TTL_MS = 60_000

function isSigningRateLimited(userId: string): boolean {
  const now = Date.now()
  const entry = rateLimitMap.get(userId)
  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(userId, { count: 1, resetAt: now + TTL_MS })
    return false
  }
  if (entry.count >= RATE_LIMIT) return true
  entry.count++
  return false
}

function pruneRateLimitMap() {
  const now = Date.now()
  rateLimitMap.forEach((v, k) => {
    if (now > v.resetAt) rateLimitMap.delete(k)
  })
}

export async function POST(request: NextRequest) {
  const isDev = process.env.NODE_ENV === 'development'

  // 1. CSRF: verify Origin header
  const origin = request.headers.get('origin') || ''

  const isKnownOrigin = [
    'https://serious-app-eight.vercel.app',
    'http://localhost:3000',
    'http://127.0.0.1:3000',
    process.env.NEXT_PUBLIC_SITE_URL,
  ].filter(Boolean).some(o => origin.startsWith(o!))

  // In development, also allow any private LAN IP (192.168.x.x, 10.x.x.x, 172.16-31.x.x)
  const isLanOrigin = isDev && /^http:\/\/(192\.168\.|10\.|172\.(1[6-9]|2[0-9]|3[01])\.)/.test(origin)

  if (!isKnownOrigin && !isLanOrigin) {
    console.warn('[upload/sign] Blocked origin:', origin)
    return Response.json({ error: 'Forbidden' }, { status: 403 })
  }

  // 2. Auth: verify session server-side
  const cookieStore = await cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return cookieStore.getAll() },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch { }
        },
      },
    }
  )

  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // 3. Rate limit by user ID
  pruneRateLimitMap()
  if (isSigningRateLimited(user.id)) {
    return Response.json({ error: 'Too many requests' }, { status: 429 })
  }

  // 4. Parse and validate body
  let body: { paramsToSign?: Record<string, unknown> }
  try {
    body = await request.json()
  } catch {
    return Response.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const { paramsToSign } = body
  if (!paramsToSign || typeof paramsToSign !== 'object') {
    return Response.json({ error: 'Missing paramsToSign' }, { status: 400 })
  }

  // 5. Validate folder
  const folder = paramsToSign.folder as string | undefined
  if (!folder || !ALLOWED_FOLDERS.has(folder)) {
    return Response.json({ error: 'Invalid folder' }, { status: 400 })
  }

  // 6. Validate timestamp to prevent signature replay attacks
  const timestamp = paramsToSign.timestamp as number | undefined
  if (!timestamp || typeof timestamp !== 'number') {
    return Response.json({ error: 'Missing timestamp' }, { status: 400 })
  }
  const ageSeconds = Math.abs(Date.now() / 1000 - timestamp)
  if (ageSeconds > 30) {
    return Response.json({ error: 'Request expired — sync your clock' }, { status: 400 })
  }

  // 7. SECURITY: Inject resource_type and allowed_formats server-side.
  //    This overwrites any client-supplied values, preventing client override.
  const constraints = FOLDER_CONSTRAINTS[folder]
  const securedParams: Record<string, unknown> = {
    ...paramsToSign,
    resource_type: constraints.resource_type,
    allowed_formats: constraints.allowed_formats,
  }

  // 8. Generate signature
  try {
    const signature = cloudinary.utils.api_sign_request(
      securedParams,
      process.env.CLOUDINARY_API_SECRET!
    )
    // Return secured params alongside signature so client uses them in the upload call
    return Response.json({
      signature,
      resource_type: constraints.resource_type,
      allowed_formats: constraints.allowed_formats,
    })
  } catch (err: unknown) {
    console.error('[upload/sign] Signing error:', err)
    return Response.json({ error: 'Signing failed' }, { status: 500 })
  }
}