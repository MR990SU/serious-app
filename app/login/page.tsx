'use client'
import { createClient } from '@/lib/supabase/client'
import { useState } from 'react'

export default function Login() {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const supabase = createClient()

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: `${location.origin}/auth/callback` }
    })
    if (error) alert(error.message)
    else alert('Check your email for the magic link!')
    setLoading(false)
  }

  return (
    <div className="flex flex-col items-center justify-center h-screen bg-black text-white p-6">
      <h1 className="text-3xl font-bold mb-8">TikTok Clone</h1>
      <form onSubmit={handleLogin} className="w-full max-w-sm flex flex-col gap-4">
        <input
          type="email"
          placeholder="Email address"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="bg-gray-900 border border-gray-700 p-4 rounded-lg text-white"
          required
        />
        <button 
          type="submit" 
          disabled={loading}
          className="bg-pink-600 p-4 rounded-lg font-bold"
        >
          {loading ? 'Sending...' : 'Send Magic Link'}
        </button>
      </form>
    </div>
  )
}