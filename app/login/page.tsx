'use client'
import { createClient } from '@/lib/supabase/client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

export default function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')

  const supabase = createClient()
  const router = useRouter()

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setMessage('')

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    })

    if (error) {
      setMessage(error.message)
    } else {
      router.push('/')
      router.refresh()
    }

    setLoading(false)
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-black text-white p-6">
      <h1 className="text-3xl font-bold mb-8">Log In</h1>

      <form onSubmit={handleLogin} className="w-full max-w-sm flex flex-col gap-4">
        <input
          type="email"
          placeholder="Email address"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="bg-gray-900 border border-gray-700 p-4 rounded-lg text-white"
          required
        />

        <input
          type="password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="bg-gray-900 border border-gray-700 p-4 rounded-lg text-white"
          required
        />

        <button
          type="submit"
          disabled={loading}
          className="bg-pink-600 p-4 rounded-lg font-bold hover:bg-pink-700 transition flex justify-center items-center h-[56px]"
        >
          {loading ? <div className="animate-spin rounded-full h-6 w-6 border-2 border-white border-t-transparent"></div> : 'Log In'}
        </button>
      </form>

      {message && (
        <div className="mt-4 p-3 bg-gray-900 border border-gray-700 rounded-lg max-w-sm text-center">
          <p className="text-sm text-gray-300">{message}</p>
        </div>
      )}

      <p className="mt-6 text-gray-400 text-sm">
        Don&apos;t have an account? <Link href="/register" className="text-pink-500 font-semibold hover:underline">Sign Up</Link>
      </p>
    </div>
  )
}