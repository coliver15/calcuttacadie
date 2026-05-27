import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Calcutta — Player',
  description: 'Live golf auction',
}

export default function PlayLayout({ children }: { children: React.ReactNode }) {
  return <div className="min-h-dvh bg-[#020617] text-white">{children}</div>
}
