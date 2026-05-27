'use client'

import { useState, useRef, useEffect } from 'react'
import type { Tournament, Team } from '@/types/database'

interface Props {
  tournament: Tournament
  connected: boolean
  meTeam: Team
  onSignOut: () => void
}

export default function PlayerHeader({ tournament, connected, meTeam, onSignOut }: Props) {
  const [menuOpen, setMenuOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false)
      }
    }
    if (menuOpen) {
      document.addEventListener('mousedown', onClick)
      return () => document.removeEventListener('mousedown', onClick)
    }
  }, [menuOpen])

  return (
    <header className="sticky top-0 z-30 flex items-center justify-between px-4 h-14 bg-slate-900/95 backdrop-blur border-b border-slate-800">
      <div className="relative" ref={menuRef}>
        <button
          onClick={() => setMenuOpen((o) => !o)}
          aria-label="Menu"
          className="p-2 -ml-2 text-slate-300 hover:text-white"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <line x1="3" y1="6" x2="21" y2="6" />
            <line x1="3" y1="12" x2="21" y2="12" />
            <line x1="3" y1="18" x2="21" y2="18" />
          </svg>
        </button>
        {menuOpen && (
          <div className="absolute left-0 top-12 z-40 w-64 rounded-xl border border-slate-700 bg-slate-900 shadow-xl py-2">
            <div className="px-4 py-2 border-b border-slate-800">
              <p className="text-xs uppercase tracking-widest text-slate-500">Signed in as</p>
              <p className="mt-0.5 text-sm font-semibold text-white truncate">
                {meTeam.player1_name} / {meTeam.player2_name}
              </p>
              <p className="mt-0.5 text-xs text-slate-400">
                Code: <span className="font-mono">{meTeam.access_code}</span>
              </p>
            </div>
            <button
              onClick={onSignOut}
              className="w-full text-left px-4 py-2.5 text-sm text-red-300 hover:bg-slate-800"
            >
              Sign out
            </button>
          </div>
        )}
      </div>
      <div className="text-center flex-1 px-2 min-w-0">
        <p className="text-xs font-semibold uppercase tracking-[0.15em] text-slate-300 truncate">
          {tournament.name}
        </p>
      </div>
      <div className="flex items-center gap-1.5 text-xs font-semibold">
        <span
          className={`h-2 w-2 rounded-full ${
            connected ? 'bg-primary-400 animate-pulse' : 'bg-slate-600'
          }`}
        />
        <span className={connected ? 'text-primary-400' : 'text-slate-500'}>
          {connected ? 'LIVE' : '...'}
        </span>
      </div>
    </header>
  )
}
