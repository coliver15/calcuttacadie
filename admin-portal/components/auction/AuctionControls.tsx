'use client'

import { useState } from 'react'
import Button from '@/components/ui/Button'
import { formatCents } from '@/lib/utils'
import type { AuctionSession, Team } from '@/types/database'
import Input from '@/components/ui/Input'

interface AuctionControlsProps {
  session: AuctionSession | null
  currentTeam: Team | null
  minBidIncrementCents: number
  onStartBidding: (openingBidCents: number) => Promise<void>
  onCloseAndAdvance: () => Promise<void>
  onPassTeam: () => Promise<void>
  disabled?: boolean
}

export default function AuctionControls({
  session,
  currentTeam,
  minBidIncrementCents,
  onStartBidding,
  onCloseAndAdvance,
  onPassTeam,
  disabled = false,
}: AuctionControlsProps) {
  const [openingBidDollars, setOpeningBidDollars] = useState('100')
  const [loading, setLoading] = useState<'start' | 'close' | 'pass' | null>(null)
  const [error, setError] = useState<string | null>(null)

  const isIdle = !session || session.status === 'pending'
  const isActive = session?.status === 'active'
  const isSoldOrPassed =
    session?.status === 'sold' || session?.status === 'passed'

  async function handleStartBidding() {
    setError(null)
    const dollars = parseFloat(openingBidDollars)
    if (isNaN(dollars) || dollars <= 0) {
      setError('Enter a valid opening bid amount')
      return
    }
    const cents = Math.round(dollars * 100)
    setLoading('start')
    try {
      await onStartBidding(cents)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to start bidding')
    } finally {
      setLoading(null)
    }
  }

  async function handleCloseAndAdvance() {
    setError(null)
    setLoading('close')
    try {
      await onCloseAndAdvance()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to close auction')
    } finally {
      setLoading(null)
    }
  }

  async function handlePassTeam() {
    setError(null)
    setLoading('pass')
    try {
      await onPassTeam()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to pass team')
    } finally {
      setLoading(null)
    }
  }

  if (!currentTeam) {
    return (
      <div className="rounded-xl bg-slate-800/50 border border-slate-700 p-6 text-center text-slate-400 text-sm">
        No team currently up for auction
      </div>
    )
  }

  return (
    <div className="rounded-xl bg-slate-900 border border-slate-700 p-5 space-y-4">
      <h3 className="text-sm font-semibold text-slate-300 uppercase tracking-wider">
        Auction Controls
      </h3>

      {error && (
        <div className="rounded-lg bg-red-900/30 border border-red-700/50 px-4 py-3 text-sm text-red-300">
          {error}
        </div>
      )}

      {/* Start bidding — only when idle */}
      {(isIdle || isSoldOrPassed) && (
        <div className="space-y-3">
          <Input
            label="Opening Bid ($)"
            type="number"
            min="1"
            step="any"
            value={openingBidDollars}
            onChange={(e) => setOpeningBidDollars(e.target.value)}
            hint={`Minimum increment: ${formatCents(minBidIncrementCents)}`}
            disabled={disabled || loading !== null}
          />
          <Button
            variant="primary"
            size="lg"
            fullWidth
            onClick={handleStartBidding}
            loading={loading === 'start'}
            disabled={disabled || (loading !== null && loading !== 'start')}
          >
            ▶ Start Bidding
          </Button>
        </div>
      )}

      {/* Active bidding controls */}
      {isActive && (
        <div className="space-y-3">
          <div className="rounded-lg bg-primary-900/20 border border-primary-700/30 px-4 py-3 text-center">
            <p className="text-xs text-primary-400 font-medium uppercase tracking-wider mb-1">
              Current High Bid
            </p>
            <p className="text-3xl font-bold tabular-nums text-primary-300">
              {formatCents(session.current_bid_cents)}
            </p>
          </div>

          <Button
            variant="primary"
            size="lg"
            fullWidth
            onClick={handleCloseAndAdvance}
            loading={loading === 'close'}
            disabled={disabled || (loading !== null && loading !== 'close')}
          >
            ✓ Close & Advance to Next Team
          </Button>

          <Button
            variant="outline"
            size="md"
            fullWidth
            onClick={handlePassTeam}
            loading={loading === 'pass'}
            disabled={disabled || (loading !== null && loading !== 'pass')}
          >
            Pass (No Sale)
          </Button>
        </div>
      )}

      {/* Status message when sold/passed */}
      {isSoldOrPassed && (
        <div
          className={`rounded-lg px-4 py-3 text-sm text-center font-medium ${
            session?.status === 'sold'
              ? 'bg-primary-900/30 text-primary-300 border border-primary-700/40'
              : 'bg-slate-800 text-slate-400 border border-slate-700'
          }`}
        >
          {session?.status === 'sold'
            ? `Sold for ${formatCents(session.current_bid_cents)}`
            : 'Passed — no sale'}
        </div>
      )}
    </div>
  )
}
