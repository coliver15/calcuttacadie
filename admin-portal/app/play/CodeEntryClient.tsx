'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'

interface Props {
  initialCode?: string
}

const CODE_LENGTH = 6

export default function CodeEntryClient({ initialCode = '' }: Props) {
  const router = useRouter()
  const [digits, setDigits] = useState<string[]>(() => {
    const arr = Array(CODE_LENGTH).fill('')
    for (let i = 0; i < Math.min(initialCode.length, CODE_LENGTH); i++) {
      arr[i] = initialCode[i]
    }
    return arr
  })
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const inputsRef = useRef<(HTMLInputElement | null)[]>([])

  const fullCode = digits.join('')
  const complete = fullCode.length === CODE_LENGTH && digits.every((d) => d !== '')

  useEffect(() => {
    // Focus first empty input on mount
    const firstEmpty = digits.findIndex((d) => d === '')
    const idx = firstEmpty === -1 ? CODE_LENGTH - 1 : firstEmpty
    inputsRef.current[idx]?.focus()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function setChar(i: number, val: string) {
    const cleaned = val.replace(/[^A-Z0-9]/gi, '').toUpperCase()
    if (!cleaned) {
      setDigits((d) => {
        const next = [...d]
        next[i] = ''
        return next
      })
      return
    }
    if (cleaned.length === 1) {
      setDigits((d) => {
        const next = [...d]
        next[i] = cleaned
        return next
      })
      if (i < CODE_LENGTH - 1) inputsRef.current[i + 1]?.focus()
    } else {
      // Pasted multi-char — distribute starting at i
      setDigits((d) => {
        const next = [...d]
        for (let k = 0; k < cleaned.length && i + k < CODE_LENGTH; k++) {
          next[i + k] = cleaned[k]
        }
        return next
      })
      const landingIdx = Math.min(i + cleaned.length, CODE_LENGTH - 1)
      inputsRef.current[landingIdx]?.focus()
    }
  }

  function onKeyDown(i: number, e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Backspace' && !digits[i] && i > 0) {
      inputsRef.current[i - 1]?.focus()
      setDigits((d) => {
        const next = [...d]
        next[i - 1] = ''
        return next
      })
      e.preventDefault()
    } else if (e.key === 'ArrowLeft' && i > 0) {
      inputsRef.current[i - 1]?.focus()
    } else if (e.key === 'ArrowRight' && i < CODE_LENGTH - 1) {
      inputsRef.current[i + 1]?.focus()
    } else if (e.key === 'Enter' && complete) {
      submit()
    }
  }

  async function submit() {
    if (!complete || submitting) return
    setSubmitting(true)
    setError(null)
    try {
      const res = await fetch('/api/play/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: fullCode }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        if (data.error === 'TOURNAMENT_COMPLETE') {
          setError('This tournament has already finished.')
        } else if (data.error === 'INVALID_CODE' || res.status === 404) {
          setError('Invalid team code. Please check and try again.')
        } else {
          setError('Something went wrong. Please try again.')
        }
        setSubmitting(false)
        return
      }
      router.push('/play/auction')
    } catch {
      setError('Network error. Please try again.')
      setSubmitting(false)
    }
  }

  return (
    <div className="min-h-dvh w-full max-w-md mx-auto px-6 py-12 flex flex-col items-center justify-center">
      {/* Logo */}
      <div className="mb-4">
        <svg width="80" height="80" viewBox="0 0 80 80" fill="none" aria-label="Calcutta">
          <ellipse cx="40" cy="52" rx="28" ry="12" fill="#16a34a" opacity="0.25" />
          <ellipse cx="40" cy="56" rx="20" ry="6" fill="#16a34a" opacity="0.15" />
          <line x1="44" y1="14" x2="44" y2="52" stroke="#94a3b8" strokeWidth="2.5" strokeLinecap="round" />
          <path d="M44 14 L44 28 L28 21 Z" fill="#16a34a" />
          <circle cx="44" cy="52" r="3" fill="#94a3b8" />
        </svg>
      </div>
      <h1 className="text-4xl font-black tracking-[0.4em] text-white leading-none">CALCUTTA</h1>
      <p className="mt-2 text-xs font-medium uppercase tracking-[0.2em] text-slate-400">
        Golf Auction Platform
      </p>

      <div className="mt-12 w-full flex flex-col items-center">
        <h2 className="text-base font-semibold text-white mb-5">Enter Your Team Code</h2>
        <div className="flex gap-2 mb-4">
          {digits.map((d, i) => (
            <input
              key={i}
              ref={(el) => {
                inputsRef.current[i] = el
              }}
              type="text"
              inputMode="text"
              autoComplete="off"
              autoCapitalize="characters"
              maxLength={1}
              value={d}
              onChange={(e) => setChar(i, e.target.value)}
              onKeyDown={(e) => onKeyDown(i, e)}
              onFocus={(e) => e.target.select()}
              className={`w-12 h-14 text-center text-2xl font-bold uppercase rounded-lg border-2 outline-none transition-colors caret-primary-500 ${
                d
                  ? 'border-primary-500 bg-primary-500/10 text-white'
                  : 'border-slate-700 bg-slate-800/80 text-white focus:border-primary-500 focus:shadow-[0_0_0_3px_rgba(34,197,94,0.15)]'
              }`}
              aria-label={`Code character ${i + 1}`}
            />
          ))}
        </div>

        {error && (
          <div className="w-full mt-2 mb-2 rounded-lg border border-red-700/50 bg-red-900/30 px-3 py-2 text-sm text-red-300 text-center">
            {error}
          </div>
        )}

        <button
          onClick={submit}
          disabled={!complete || submitting}
          className="mt-6 w-full rounded-xl bg-primary-600 hover:bg-primary-500 disabled:bg-slate-700 disabled:text-slate-500 text-white font-bold tracking-wider py-4 transition-colors"
        >
          {submitting ? 'Joining…' : 'Enter Tournament'}
        </button>

        <p className="mt-6 text-xs text-slate-500 text-center">
          Don&rsquo;t have a code? Ask the tournament admin.
        </p>
      </div>
    </div>
  )
}
