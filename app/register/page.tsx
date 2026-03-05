'use client'
import { createClient } from '@/lib/supabase/client'
import { useState } from 'react'
import Link from 'next/link'
import { Mail, CheckCircle2, Loader2 } from 'lucide-react'

export default function Register() {
    const [email, setEmail] = useState('')
    const [password, setPassword] = useState('')
    const [username, setUsername] = useState('')
    const [fullName, setFullName] = useState('')
    const [submitted, setSubmitted] = useState(false)
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState('')

    const supabase = createClient()

    const handleRegister = async (e: React.FormEvent) => {
        e.preventDefault()
        setLoading(true)
        setError('')

        if (!username.trim() || !email.trim() || !password.trim()) {
            setError('Username, email, and password are required.')
            setLoading(false)
            return
        }

        if (username.length < 3) {
            setError('Username must be at least 3 characters.')
            setLoading(false)
            return
        }

        // Determine the correct callback URL based on environment
        const siteUrl =
            process.env.NODE_ENV === 'development'
                ? 'http://localhost:3000'
                : process.env.NEXT_PUBLIC_SITE_URL || 'https://serious-app-eight.vercel.app'

        const { data, error: signUpError } = await supabase.auth.signUp({
            email,
            password,
            options: {
                emailRedirectTo: `${siteUrl}/auth/callback`,
                data: {
                    username: username.trim(),
                    full_name: fullName.trim(),
                },
            },
        })

        if (signUpError) {
            setError(signUpError.message)
            setLoading(false)
            return
        }

        // Pre-create profile row to prevent race conditions if DB trigger is slow
        if (data.user) {
            await supabase.from('profiles').upsert({
                id: data.user.id,
                username: username.trim(),
                full_name: fullName.trim() || null,
            }, { onConflict: 'id' })
        }

        setSubmitted(true)
        setLoading(false)
    }

    // ── Step 2: Email sent confirmation screen ──────────────────────────────
    if (submitted) {
        return (
            <div className="flex flex-col items-center justify-center min-h-screen bg-black text-white p-6">
                <div className="relative mb-6">
                    <div className="w-20 h-20 rounded-full bg-brand-primary/10 flex items-center justify-center">
                        <Mail size={40} className="text-brand-primary" />
                    </div>
                    <CheckCircle2 size={22} className="text-green-400 absolute -bottom-1 -right-1 bg-black rounded-full" />
                </div>

                <h1 className="text-2xl font-bold mb-2 text-center">Check your email</h1>
                <p className="text-gray-400 text-center max-w-xs mb-6">
                    We sent a confirmation link to{' '}
                    <span className="text-white font-semibold">{email}</span>.
                    Click the link to activate your account.
                </p>

                <div className="w-full max-w-sm bg-gray-900/60 border border-white/10 rounded-xl p-4 text-sm text-gray-400 text-center">
                    <p>Didn&apos;t receive it? Check your spam folder.</p>
                </div>

                <p className="mt-8 text-gray-400 text-sm">
                    Already verified?{' '}
                    <Link href="/login" className="text-pink-500 font-semibold hover:underline">
                        Log In
                    </Link>
                </p>
            </div>
        )
    }

    // ── Step 1: Registration form ───────────────────────────────────────────
    return (
        <div className="flex flex-col items-center justify-center min-h-screen bg-black text-white p-6">
            <h1 className="text-3xl font-bold mb-2">Create an account</h1>
            <p className="text-gray-400 mb-8 text-center max-w-xs text-sm">
                Sign up to start sharing videos.
            </p>

            <form onSubmit={handleRegister} className="w-full max-w-sm flex flex-col gap-4">
                <input
                    type="text"
                    placeholder="Full Name (optional)"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    className="bg-gray-900 border border-gray-700 p-4 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-pink-500 transition-colors"
                    disabled={loading}
                />
                <input
                    type="text"
                    placeholder="Username"
                    value={username}
                    onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''))}
                    className="bg-gray-900 border border-gray-700 p-4 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-pink-500 transition-colors"
                    required
                    minLength={3}
                    maxLength={30}
                    disabled={loading}
                />
                <input
                    type="email"
                    placeholder="Email address"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="bg-gray-900 border border-gray-700 p-4 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-pink-500 transition-colors"
                    required
                    disabled={loading}
                />
                <input
                    type="password"
                    placeholder="Password (min. 6 characters)"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="bg-gray-900 border border-gray-700 p-4 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-pink-500 transition-colors"
                    required
                    minLength={6}
                    disabled={loading}
                />

                {error && (
                    <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-lg">
                        <p className="text-sm text-red-400">{error}</p>
                    </div>
                )}

                <button
                    type="submit"
                    disabled={loading}
                    className="bg-pink-600 p-4 rounded-lg font-bold hover:bg-pink-700 transition flex justify-center items-center h-[56px] mt-2 disabled:opacity-50"
                >
                    {loading ? <Loader2 className="animate-spin" size={22} /> : 'Create Account'}
                </button>
            </form>

            <p className="mt-8 text-gray-400 text-sm">
                Already have an account?{' '}
                <Link href="/login" className="text-pink-500 font-semibold hover:underline">
                    Log In
                </Link>
            </p>
        </div>
    )
}
