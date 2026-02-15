import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import BottomNav from '@/components/nav/BottomNav'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'TikTok Clone',
  description: 'Built with Next.js & Supabase',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <main className="h-[100dvh] w-full max-w-md mx-auto relative bg-black overflow-hidden">
          {children}
          <BottomNav />
        </main>
      </body>
    </html>
  )
}