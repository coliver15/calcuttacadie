import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
})

export const metadata: Metadata = {
  title: {
    default: 'Calcutta Admin',
    template: '%s | Calcutta Admin',
  },
  description:
    'Golf Calcutta auction management platform for tournament administrators.',
  keywords: ['golf', 'calcutta', 'auction', 'tournament', 'admin'],
  robots: { index: false, follow: false },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" className={inter.variable}>
      <body className="min-h-screen bg-[#020617] font-sans antialiased">
        {children}
      </body>
    </html>
  )
}
