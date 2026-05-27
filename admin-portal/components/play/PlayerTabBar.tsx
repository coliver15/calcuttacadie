'use client'

import Link from 'next/link'
import { cn } from '@/lib/utils'

interface Props {
  active: 'auction' | 'portfolio'
}

export default function PlayerTabBar({ active }: Props) {
  return (
    <nav className="fixed bottom-0 left-0 right-0 z-30 border-t border-slate-800 bg-slate-900/95 backdrop-blur h-16 flex items-stretch pb-[env(safe-area-inset-bottom)]">
      <Link
        href="/play/auction"
        className={cn(
          'flex-1 flex flex-col items-center justify-center gap-0.5 transition-colors',
          active === 'auction' ? 'text-primary-400' : 'text-slate-500'
        )}
      >
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
          <line x1="12" y1="2" x2="12" y2="18" />
          <path d="M12 2L12 8L6 5Z" fill="currentColor" stroke="none" />
          <ellipse cx="12" cy="20" rx="8" ry="3" opacity="0.4" />
        </svg>
        <span className="text-[10px] font-semibold uppercase tracking-wider">Auction</span>
      </Link>
      <Link
        href="/play/portfolio"
        className={cn(
          'flex-1 flex flex-col items-center justify-center gap-0.5 transition-colors',
          active === 'portfolio' ? 'text-primary-400' : 'text-slate-500'
        )}
      >
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
          <rect x="3" y="3" width="7" height="7" rx="1" />
          <rect x="14" y="3" width="7" height="7" rx="1" />
          <rect x="3" y="14" width="7" height="7" rx="1" />
          <rect x="14" y="14" width="7" height="7" rx="1" />
        </svg>
        <span className="text-[10px] font-semibold uppercase tracking-wider">Portfolio</span>
      </Link>
    </nav>
  )
}
