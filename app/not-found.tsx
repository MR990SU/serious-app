import Link from 'next/link'

export default function NotFound() {
    return (
        <div className="min-h-screen bg-black text-white flex flex-col items-center justify-center p-6">
            <div className="text-8xl font-black text-white/10 mb-4 select-none">404</div>
            <h1 className="text-2xl font-bold mb-2">Page not found</h1>
            <p className="text-gray-400 text-center max-w-xs mb-8">
                This page doesn&apos;t exist or has been moved.
            </p>
            <Link
                href="/"
                className="px-6 py-3 bg-brand-accent text-white rounded-xl font-bold hover:opacity-80 transition"
            >
                Back to Home
            </Link>
        </div>
    )
}
