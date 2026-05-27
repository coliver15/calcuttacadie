'use client'

import { useEffect, useRef } from 'react'
import QRCode from 'qrcode'
import type { Tournament, Team } from '@/types/database'

interface Props {
  tournament: Tournament
  teams: Team[]
}

export default function PrintQrClient({ tournament, teams }: Props) {
  const canvasRefs = useRef<Map<string, HTMLCanvasElement | null>>(new Map())

  useEffect(() => {
    const origin = window.location.origin
    teams.forEach((t) => {
      const canvas = canvasRefs.current.get(t.id)
      if (!canvas) return
      const link = `${origin}/play?code=${t.access_code}`
      QRCode.toCanvas(canvas, link, {
        width: 240,
        margin: 1,
        color: { dark: '#0f172a', light: '#ffffff' },
        errorCorrectionLevel: 'M',
      }).catch(() => {})
    })
  }, [teams])

  return (
    <div className="min-h-screen bg-white text-slate-900 p-8">
      <div className="no-print mb-6 flex items-center justify-between max-w-5xl mx-auto">
        <div>
          <h1 className="text-xl font-bold">{tournament.name} — Team QR Codes</h1>
          <p className="text-sm text-slate-600 mt-0.5">
            {teams.length} team{teams.length !== 1 ? 's' : ''}
          </p>
        </div>
        <button
          onClick={() => window.print()}
          className="rounded-lg bg-primary-600 hover:bg-primary-500 text-white font-semibold px-4 py-2"
        >
          Print
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6 max-w-5xl mx-auto print:gap-4 print:grid-cols-3">
        {teams.map((t) => (
          <div
            key={t.id}
            className="rounded-2xl border border-slate-300 p-5 text-center break-inside-avoid"
          >
            <p className="text-[10px] uppercase tracking-[0.25em] text-slate-500">
              Calcutta Auction
            </p>
            <h2 className="mt-1 text-base font-bold tracking-tight">
              {t.player1_name} / {t.player2_name}
            </h2>
            <div className="mt-3 flex justify-center">
              <canvas
                ref={(el) => {
                  canvasRefs.current.set(t.id, el)
                }}
              />
            </div>
            <p className="mt-3 text-[10px] uppercase tracking-wider text-slate-500">
              Team Code
            </p>
            <p className="mt-0.5 text-xl font-bold tracking-[0.3em] font-mono">
              {t.access_code}
            </p>
          </div>
        ))}
      </div>

      <style jsx global>{`
        @media print {
          .no-print {
            display: none !important;
          }
          @page {
            margin: 12mm;
          }
        }
      `}</style>
    </div>
  )
}
