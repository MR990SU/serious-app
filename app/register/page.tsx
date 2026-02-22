'use client'
import { createClient } from '@/lib/supabase/client'
import { useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

export default function Register() {
    // Step 1: Registration State
    const [email, setEmail] = useState('')
    const [password, setPassword] = useState('')
    const [username, setUsername] = useState('')
    const [fullName, setFullName] = useState('')

    // Step 2: OTP State
    const [otpSent, setOtpSent] = useState(false)
    const [otp, setOtp] = useState(['', '', '', '', '', ''])
    const otpRefs = useRef<(HTMLInputElement | null)[]>([])

    // Global UI State
    const [loading, setLoading] = useState(false)
    const [message, setMessage] = useState('')

    const supabase = createClient()
    const router = useRouter()

    const handleRegister = async (e: React.FormEvent) => {
        e.preventDefault()
        setLoading(true)
        setMessage('')

        if (!username || !email || !password) {
            setMessage('Username, Email, and Password are required.')
            setLoading(false)
            return
        }

        const { data, error } = await supabase.auth.signUp({
            email,
            password,
            options: {
                data: {
                    username: username,
                    full_name: fullName,
                },
            },
        })

        if (error) {
            setMessage(error.message)
        } else {
            // Force inserting profile row to prevent 'profile not found' if trigger is slow
            if (data.user) {
                await supabase.from('profiles').upsert({
                    id: data.user.id,
                    username: username,
                    full_name: fullName,
                }, { onConflict: 'id' }).select()
            }

            // Move to OTP Step
            setOtpSent(true)
            setMessage('A 6-digit confirmation code has been sent to your email.')
        }
        setLoading(false)
    }

    const handleOtpChange = (index: number, value: string) => {
        // Only allow numbers
        if (!/^\d*$/.test(value)) return;

        const newOtp = [...otp]
        newOtp[index] = value
        setOtp(newOtp)

        // Auto focus next input
        if (value && index < 5) {
            otpRefs.current[index + 1]?.focus()
        }
    }

    const handleOtpKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
        // Move to previous input on backspace if current is empty
        if (e.key === 'Backspace' && !otp[index] && index > 0) {
            otpRefs.current[index - 1]?.focus()
        }
    }

    const handleVerifyOtp = async (e: React.FormEvent) => {
        e.preventDefault()

        const fullOtp = otp.join('')
        if (fullOtp.length < 6) {
            setMessage('Please enter all 6 digits.')
            return;
        }

        setLoading(true)
        setMessage('')

        const { data, error } = await supabase.auth.verifyOtp({
            email,
            token: fullOtp,
            type: 'signup'
        })

        if (error) {
            setMessage(error.message)
            setLoading(false)
        } else {
            setMessage('Account verified! Logging you in...')
            setTimeout(() => {
                router.push('/')
            }, 1000)
        }
    }

    return (
        <div className="flex flex-col items-center justify-center min-h-screen bg-black text-white p-6">
            <h1 className="text-3xl font-bold mb-2">
                {otpSent ? 'Check your email' : 'Create an Account'}
            </h1>
            <p className="text-gray-400 mb-8 text-center max-w-xs">
                {otpSent ? `We sent a 6-digit code to ${email}` : 'Sign up to start sharing videos.'}
            </p>

            {!otpSent ? (
                // --- STEP 1: REGISTRATION FORM ---
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
                        onChange={(e) => setUsername(e.target.value)}
                        className="bg-gray-900 border border-gray-700 p-4 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-pink-500 transition-colors"
                        required
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
                        placeholder="Password (Min 6 chars)"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        className="bg-gray-900 border border-gray-700 p-4 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-pink-500 transition-colors"
                        required
                        minLength={6}
                        disabled={loading}
                    />

                    <button
                        type="submit"
                        disabled={loading}
                        className="bg-pink-600 p-4 rounded-lg font-bold hover:bg-pink-700 transition flex justify-center items-center h-[56px] mt-2 disabled:opacity-50"
                    >
                        {loading ? <div className="animate-spin rounded-full h-6 w-6 border-2 border-white border-t-transparent"></div> : 'Sign Up'}
                    </button>
                </form>
            ) : (
                // --- STEP 2: OTP VERIFICATION FORM ---
                <form onSubmit={handleVerifyOtp} className="w-full max-w-sm flex flex-col gap-6">
                    <div className="flex justify-between gap-2">
                        {otp.map((digit, index) => (
                            <input
                                key={index}
                                ref={(el) => { otpRefs.current[index] = el }}
                                type="text"
                                inputMode="numeric"
                                maxLength={1}
                                value={digit}
                                onChange={(e) => handleOtpChange(index, e.target.value)}
                                onKeyDown={(e) => handleOtpKeyDown(index, e)}
                                className="w-12 h-14 bg-gray-900 border border-gray-700 rounded-lg text-center text-xl text-white focus:outline-none focus:border-pink-500 transition-colors"
                                disabled={loading}
                                autoFocus={index === 0}
                            />
                        ))}
                    </div>

                    <button
                        type="submit"
                        disabled={loading || otp.join('').length < 6}
                        className="bg-white text-black p-4 rounded-lg font-bold hover:bg-gray-200 transition flex justify-center items-center h-[56px] disabled:opacity-50"
                    >
                        {loading ? <div className="animate-spin rounded-full h-6 w-6 border-2 border-black border-t-transparent"></div> : 'Verify Code'}
                    </button>

                    <button
                        type="button"
                        onClick={() => setOtpSent(false)}
                        className="text-gray-400 text-sm hover:text-white transition-colors"
                        disabled={loading}
                    >
                        Change email address
                    </button>
                </form>
            )}

            {message && (
                <div className="mt-6 p-4 bg-gray-900 border border-gray-700 rounded-lg max-w-sm w-full text-center">
                    <p className={`text-sm ${message.includes('error') || message.includes('required') ? 'text-red-400' : 'text-green-400'}`}>
                        {message}
                    </p>
                </div>
            )}

            {!otpSent && (
                <p className="mt-8 text-gray-400 text-sm">
                    Already have an account? <Link href="/login" className="text-pink-500 font-semibold hover:underline">Log In</Link>
                </p>
            )}
        </div>
    )
}
