'use client'

import { useEffect } from 'react'
import Link from 'next/link'

export default function Error({
    error,
    reset,
}: {
    error: Error & { digest?: string }
    reset: () => void
}) {
    useEffect(() => {
        // Log to console for production debugging
        console.error('[Error Boundary]', error)
    }, [error])

    return (
        <div className="min-h-screen bg-black text-white flex flex-col items-center justify-center p-6">
            <div className="text-6xl mb-6">⚠️</div>
            <h1 className="text-2xl font-bold mb-2">Something went wrong</h1>
            <p className="text-gray-400 text-center max-w-xs mb-8">
                {error?.message || 'An unexpected error occurred.'}
            </p>
            <div className="flex gap-4">
                <button
                    onClick={reset}
                    className="px-6 py-3 bg-brand-accent text-white rounded-xl font-bold hover:opacity-80 transition"
                >
                    Try Again
                </button>
                <Link
                    href="/"
                    className="px-6 py-3 bg-white/10 text-white rounded-xl font-bold hover:bg-white/20 transition"
                >
                    Go Home
                </Link>
            </div>
            {error?.digest && (
                <p className="mt-6 text-xs text-gray-600">Error ID: {error.digest}</p>
            )}
        </div>
    )
}
