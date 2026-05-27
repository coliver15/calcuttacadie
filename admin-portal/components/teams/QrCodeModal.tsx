'use client'

import { useEffect, useRef, useState } from 'react'
import QRCode from 'qrcode'
import type { Team } from '@/types/database'

interface Props {
  open: boolean
  onClose: () => void
  team: Team | null
}

export default function QrCodeModal({ open, onClose, team }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [url, setUrl] = useState<string>('')

  useEffect(() => {
    if (!open || !team) return
    const origin =
      typeof window !== 'undefined' ? window.location.origin : ''
    const link = `${origin}/play?code=${team.access_code}`
    setUrl(link)
    if (canvasRef.current) {
      QRCode.toCanvas(canvasRef.current, link, {
        width: 320,
        margin: 2,
        color: { dark: '#0f172a', light: '#ffffff' },
        errorCorrectionLevel: 'M',
      }).catch(() => {})
    }
  }, [open, team])

  if (!open || !team) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
    >
      <div className="absolute inset-0 bg-black/70" onClick={onClose} />

      <div className="relative w-full max-w-sm">
        {/* Card to be printed */}
        <div
          id="qr-print-area"
          className="rounded-2xl bg-white text-slate-900 p-6 shadow-2xl"
        >
          <div className="text-center">
            <p className="text-[10px] uppercase tracking-[0.25em] text-slate-500">
              Calcutta Auction
            </p>
            <h2 className="mt-1 text-xl font-bold tracking-tight text-slate-900">
              {team.player1_name} / {team.player2_name}
            </h2>
          </div>
          <div className="mt-4 flex justify-center">
            <canvas ref={canvasRef} className="rounded-lg" />
          </div>
          <div className="mt-4 text-center">
            <p className="text-xs uppercase tracking-wider text-slate-500">
              Team Code
            </p>
            <p className="mt-1 text-3xl font-bold tracking-[0.4em] font-mono text-slate-900">
              {team.access_code}
            </p>
            <p className="mt-3 text-xs text-slate-500 break-all">{url}</p>
          </div>
        </div>

        {/* Controls — hidden in print */}
        <div className="mt-4 flex items-center justify-between gap-3 no-print">
          <button
            onClick={() => window.print()}
            className="flex-1 rounded-lg bg-primary-600 hover:bg-primary-500 text-white font-semibold py-2.5 transition-colors"
          >
            Print
          </button>
          <button
            onClick={onClose}
            className="flex-1 rounded-lg bg-slate-700 hover:bg-slate-600 text-white font-semibold py-2.5 transition-colors"
          >
            Close
          </button>
        </div>
      </div>

      <style jsx global>{`
        @media print {
          body * {
            visibility: hidden !important;
          }
          #qr-print-area,
          #qr-print-area * {
            visibility: visible !important;
          }
          #qr-print-area {
            position: absolute !important;
            inset: 0 !important;
            margin: auto !important;
            box-shadow: none !important;
          }
          .no-print {
            display: none !important;
          }
        }
      `}</style>
    </div>
  )
}
