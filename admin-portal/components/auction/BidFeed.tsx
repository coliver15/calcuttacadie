'use client'

import { useEffect, useRef } from 'react'
import { cn } from '@/lib/utils'
import { formatCents, formatTimeAgo } from '@/lib/utils'
import type { BidWithTeam } from '@/types/database'

interface BidFeedProps {
  bids: BidWithTeam[]
  className?: string
  maxItems?: number
  compact?: boolean
}

export default function BidFeed({
  bids,
  className,
  maxItems = 20,
  compact = false,
}: BidFeedProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const lastBidId = useRef<string | null>(null)

  // Auto-scroll to top when new bids arrive (newest first)
  useEffect(() => {
    if (bids.length > 0 && bids[0].id !== lastBidId.current) {
      lastBidId.current = bids[0].id
      if (containerRef.current) {
        containerRef.current.scrollTop = 0
      }
    }
  }, [bids])

  const displayed = bids.slice(0, maxItems)

  if (displayed.length === 0) {
    return (
      <div
        className={cn(
          'flex items-center justify-center text-slate-500 text-sm',
          compact ? 'h-20' : 'h-40',
          className
        )}
      >
        No bids yet
      </div>
    )
  }

  return (
    <div
      ref={containerRef}
      className={cn(
        'overflow-y-auto space-y-1.5 pr-1',
        compact ? 'max-h-48' : 'max-h-96',
        className
      )}
    >
      {displayed.map((bid, index) => (
        <div
          key={bid.id}
          className={cn(
            'flex items-center justify-between gap-3 rounded-lg px-3 py-2 text-sm transition-all duration-300',
            index === 0 && bid.is_winning
              ? 'bg-primary-900/40 border border-primary-700/50'
              : 'bg-slate-800/60 border border-transparent',
            'animate-slide-in'
          )}
          style={{ animationDelay: '0ms' }}
        >
          <div className="flex items-center gap-2 min-w-0">
            {index === 0 && bid.is_winning && (
              <span className="flex-shrink-0 text-primary-400" aria-label="Leading bid">
                ★
              </span>
            )}
            <div className="min-w-0">
              <span className="font-medium text-slate-200 truncate block">
                {bid.bidder_team.player1_name} / {bid.bidder_team.player2_name}
              </span>
              {!compact && (
                <span className="text-xs text-slate-500">
                  {formatTimeAgo(bid.created_at)}
                </span>
              )}
            </div>
          </div>
          <span
            className={cn(
              'font-semibold tabular-nums flex-shrink-0',
              index === 0 && bid.is_winning ? 'text-primary-300' : 'text-slate-300'
            )}
          >
            {formatCents(bid.amount_cents)}
          </span>
        </div>
      ))}
    </div>
  )
}
