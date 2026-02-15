'use client'
import { createClient } from '@/lib/supabase/client'
import { useState } from 'react'
import { useRouter } from 'next/navigation' // Added for redirecting

export default function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('') // New state for password
  const [loading, setLoading] = useState(false)
  
  const supabase = createClient()
  const router = useRouter() // Initialize router

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    // Using signInWithPassword instead of signInWithOtp
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    })

    if (error) {
      alert(error.message)
    } else {
      // Refresh the page or redirect to feed after successful login
      router.push('/')
      router.refresh() 
    }
    
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

        <input
          type="password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="bg-gray-900 border border-gray-700 p-4 rounded-lg text-white"
          required
          minLength={6}
        />

        <button 
          type="submit" 
          disabled={loading}
          className="bg-pink-600 p-4 rounded-lg font-bold hover:bg-pink-700 transition"
        >
          {loading ? 'Logging in...' : 'Log In'}
        </button>
      </form>

      <p className="mt-4 text-gray-400 text-sm">
        Don't have an account? <span className="text-pink-500 cursor-pointer">Sign Up</span>
      </p>
    </div>
  )
}