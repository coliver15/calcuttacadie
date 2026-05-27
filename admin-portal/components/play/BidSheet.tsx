'use client'

import { useEffect, useState } from 'react'
import { formatCents } from '@/lib/utils'

interface Props {
  open: boolean
  onClose: () => void
  minBidCents: number
  onSubmit: (amountCents: number) => Promise<boolean>
  error: string | null
  submitting: boolean
}

export default function BidSheet({
  open,
  onClose,
  minBidCents,
  onSubmit,
  error,
  submitting,
}: Props) {
  // The user types whole-dollar amounts; we convert to cents on submit.
  const [dollars, setDollars] = useState<string>('')

  useEffect(() => {
    if (open) {
      // Reset to empty when opened; pre-suggest min via placeholder
      setDollars('')
    }
  }, [open])

  function append(d: string) {
    if (submitting) return
    setDollars((prev) => {
      if (prev.length >= 6) return prev // cap at $999,999
      // Avoid leading zeros
      if (prev === '0') return d
      return prev + d
    })
  }
  function backspace() {
    if (submitting) return
    setDollars((prev) => prev.slice(0, -1))
  }
  function clear() {
    if (submitting) return
    setDollars('')
  }
  function addAmount(n: number) {
    if (submitting) return
    const minDollars = Math.ceil(minBidCents / 100)
    const cur = parseInt(dollars || '0', 10) || 0
    const base = cur === 0 ? minDollars : cur
    setDollars(String(base + n))
  }

  const currentCents = (parseInt(dollars || '0', 10) || 0) * 100
  const validAmount = currentCents >= minBidCents && currentCents > 0

  async function confirm() {
    if (!validAmount) return
    await onSubmit(currentCents)
  }

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center"
      role="dialog"
      aria-modal="true"
    >
      <div
        className="absolute inset-0 bg-black/70 animate-fade-in"
        onClick={() => !submitting && onClose()}
      />

      <div className="relative w-full sm:max-w-md bg-slate-900 border-t border-slate-700 sm:border sm:rounded-2xl rounded-t-2xl p-5 pb-[max(20px,env(safe-area-inset-bottom))] animate-slide-up">
        <div className="mx-auto mb-3 w-10 h-1 rounded-full bg-slate-700 sm:hidden" />

        <div className="flex items-center justify-between mb-3">
          <p className="text-sm text-slate-400">
            Minimum bid:{' '}
            <span className="font-semibold text-primary-400">
              {formatCents(minBidCents)}
            </span>
          </p>
          <button
            onClick={onClose}
            disabled={submitting}
            className="text-slate-400 hover:text-white text-xl leading-none p-1"
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        <div className="flex items-baseline justify-center gap-1 my-4">
          <span className="text-3xl font-bold text-slate-500">$</span>
          <span
            className={`text-6xl font-bold tabular-nums ${
              validAmount ? 'text-primary-400' : 'text-white'
            }`}
          >
            {dollars || '0'}
          </span>
        </div>

        <div className="grid grid-cols-3 gap-2 mb-3">
          {[50, 100, 200].map((n) => (
            <button
              key={n}
              onClick={() => addAmount(n)}
              disabled={submitting}
              className="rounded-lg bg-slate-800 hover:bg-slate-700 disabled:opacity-50 py-2.5 text-sm font-semibold text-slate-200"
            >
              +${n}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-3 gap-2">
          {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((k) => (
            <button
              key={k}
              onClick={() => append(k)}
              disabled={submitting}
              className="rounded-lg bg-slate-800 hover:bg-slate-700 disabled:opacity-50 py-4 text-xl font-semibold text-white"
            >
              {k}
            </button>
          ))}
          <button
            onClick={clear}
            disabled={submitting}
            className="rounded-lg bg-slate-800 hover:bg-slate-700 disabled:opacity-50 py-4 text-base font-semibold text-slate-300"
          >
            C
          </button>
          <button
            onClick={() => append('0')}
            disabled={submitting}
            className="rounded-lg bg-slate-800 hover:bg-slate-700 disabled:opacity-50 py-4 text-xl font-semibold text-white"
          >
            0
          </button>
          <button
            onClick={backspace}
            disabled={submitting}
            className="rounded-lg bg-slate-800 hover:bg-slate-700 disabled:opacity-50 py-4 text-base font-semibold text-slate-300"
            aria-label="Backspace"
          >
            ⌫
          </button>
        </div>

        {error && (
          <div className="mt-3 rounded-lg border border-red-700/50 bg-red-900/30 px-3 py-2 text-sm text-red-300 text-center">
            {error}
          </div>
        )}

        <button
          onClick={confirm}
          disabled={!validAmount || submitting}
          className="mt-4 w-full rounded-xl bg-primary-600 hover:bg-primary-500 disabled:bg-slate-700 disabled:text-slate-500 text-white font-bold py-4 transition-colors"
        >
          {submitting
            ? 'PLACING BID…'
            : validAmount
            ? `CONFIRM BID — ${formatCents(currentCents)}`
            : 'ENTER A VALID BID'}
        </button>
      </div>
    </div>
  )
}
