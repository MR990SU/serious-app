import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import BottomNav from '@/components/nav/BottomNav'
import TopNav from '@/components/nav/TopNav'
import SideNav from '@/components/nav/SideNav'
import RightNav from '@/components/nav/RightNav'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'Verve - Digital Ethereal',
  description: 'Built with Next.js & Supabase',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className={`${inter.className} bg-black text-white antialiased`}>
        <div className="flex h-[100dvh] w-full overflow-hidden">

          {/* Desktop Left Nav */}
          <div className="hidden md:flex flex-col w-[260px] lg:w-[300px] py-6 glass-dark border-r border-white/5 z-50 relative">
            <SideNav />
          </div>

          {/* Mobile Top Nav (Overlay) */}
          <div className="md:hidden absolute top-0 left-0 w-full z-50 pointer-events-none">
            {/* We add pointer-events-none to the container so we don't block clicks on the video, 
                 and re-enable it on the children */}
            <div className="pointer-events-auto">
              <TopNav />
            </div>
          </div>

          {/* Center Main Area (Video Feed / Content) */}
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

        </div>
      </body>
    </html>
  )
}