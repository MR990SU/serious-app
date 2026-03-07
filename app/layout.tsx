import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import BottomNav from '@/components/nav/BottomNav'
import TopNav from '@/components/nav/TopNav'
import SideNav from '@/components/nav/SideNav'
import RightNav from '@/components/nav/RightNav'
import { AuthProvider } from '@/components/AuthProvider'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'Verve - Digital Ethereal',
  description: 'Share and discover short videos.',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <head>
        {/* CDN preconnect — eliminates DNS + TLS handshake latency */}
        <link rel="preconnect" href="https://res.cloudinary.com" />
        <link rel="dns-prefetch" href="https://res.cloudinary.com" />
        <link rel="preconnect" href={process.env.NEXT_PUBLIC_SUPABASE_URL!} />
        <link rel="dns-prefetch" href={process.env.NEXT_PUBLIC_SUPABASE_URL!} />
      </head>
      <body className={inter.className}>
        <AuthProvider>
          <div className="flex h-[100dvh] w-full overflow-hidden bg-black text-white antialiased">

            {/* Desktop Left Nav */}
            <div className="hidden md:flex flex-col w-[260px] lg:w-[300px] py-6 glass-dark border-r border-white/5 z-50 relative">
              <SideNav />
            </div>

            {/* Mobile Top Nav (Overlay) */}
            <div className="md:hidden absolute top-0 left-0 w-full z-50 pointer-events-none">
              <div className="pointer-events-auto">
                <TopNav />
              </div>
            </div>

            {/* Center Main Area */}
            <main className="flex-1 relative bg-black h-[100dvh] w-full max-w-[100vw] overflow-hidden">
              {children}
            </main>

            {/* Desktop Right Nav */}
            <div className="hidden lg:flex flex-col w-[320px] py-6 px-4 glass-dark border-l border-white/5 z-50 overflow-y-auto no-scrollbar relative">
              <RightNav />
            </div>

            {/* Mobile Bottom Nav */}
            <div className="md:hidden absolute bottom-0 left-0 w-full z-50">
              <BottomNav />
            </div>

            {/* Next.js hydrated Modal Portal target */}
            <div id="modal-root" />
          </div>
        </AuthProvider>
      </body>
    </html>
  )
}