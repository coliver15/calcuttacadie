'use client'

import { useEffect, useState, useCallback } from 'react'
import { cn } from '@/lib/utils'
import { computeTimerRemaining, formatTimerSeconds } from '@/lib/utils'

interface AuctionTimerProps {
  timerStartedAt: string | null
  timerDurationSeconds: number
  className?: string
  size?: 'sm' | 'md' | 'lg' | 'xl'
  showLabel?: boolean
  onExpired?: () => void
}

export default function AuctionTimer({
  timerStartedAt,
  timerDurationSeconds,
  className,
  size = 'md',
  showLabel = true,
  onExpired,
}: AuctionTimerProps) {
  const [remaining, setRemaining] = useState<number>(
    computeTimerRemaining(timerStartedAt, timerDurationSeconds)
  )

  const tick = useCallback(() => {
    const r = computeTimerRemaining(timerStartedAt, timerDurationSeconds)
    setRemaining(r)
    if (r === 0) {
      onExpired?.()
    }
  }, [timerStartedAt, timerDurationSeconds, onExpired])

  useEffect(() => {
    // Recalculate immediately when props change
    tick()

    if (!timerStartedAt) return

    const interval = setInterval(tick, 250)
    return () => clearInterval(interval)
  }, [timerStartedAt, timerDurationSeconds, tick])

  const isUrgent = remaining <= 10 && remaining > 0
  const isExpired = remaining === 0
  const isRunning = timerStartedAt !== null

  const textSizeClass = {
    sm: 'text-2xl',
    md: 'text-4xl',
    lg: 'text-6xl',
    xl: 'text-8xl',
  }[size]

  const labelSizeClass = {
    sm: 'text-xs',
    md: 'text-sm',
    lg: 'text-base',
    xl: 'text-lg',
  }[size]

  return (
    <div
      className={cn(
        'flex flex-col items-center gap-1',
        className
      )}
      aria-live="polite"
      aria-label={`Timer: ${formatTimerSeconds(remaining)} remaining`}
    >
      {showLabel && (
        <span className={cn('font-medium text-slate-400 uppercase tracking-widest', labelSizeClass)}>
          {isExpired ? 'Time' : 'Time Remaining'}
        </span>
      )}
      <span
        className={cn(
          'font-mono font-bold tabular-nums transition-colors duration-300',
          textSizeClass,
          isExpired
            ? 'text-red-400'
            : isUrgent
            ? 'text-yellow-400 animate-pulse'
            : isRunning
            ? 'text-primary-400'
            : 'text-slate-400'
        )}
      >
        {formatTimerSeconds(remaining)}
      </span>
      {isExpired && (
        <span className={cn('font-semibold text-red-400', labelSizeClass)}>
          Expired
        </span>
      )}
    </div>
  )
}
