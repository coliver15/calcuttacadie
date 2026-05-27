'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import { formatCents, formatHandicap, computeTimerRemaining } from '@/lib/utils'
import type {
  Tournament,
  Team,
  AuctionSession,
  Bid,
  RealtimeAuctionEvent,
} from '@/types/database'
import PlayerTabBar from '@/components/play/PlayerTabBar'
import PlayerHeader from '@/components/play/PlayerHeader'
import BidSheet from '@/components/play/BidSheet'

function createRealtimeClient() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { realtime: { params: { eventsPerSecond: 20 } } }
  )
}

interface Props {
  tournament: Tournament
  me: Team
  teams: Team[]
  initialSession: AuctionSession | null
  initialBids: Bid[]
}

export default function PlayerAuctionClient({
  tournament,
  me,
  teams: initialTeams,
  initialSession,
  initialBids,
}: Props) {
  const router = useRouter()
  const [teams, setTeams] = useState<Team[]>(initialTeams)
  const [session, setSession] = useState<AuctionSession | null>(initialSession)
  const [bids, setBids] = useState<Bid[]>(initialBids)
  const [currentTeamId, setCurrentTeamId] = useState<string | null>(
    initialSession?.team_id ?? null
  )
  const [connected, setConnected] = useState(false)
  const [sheetOpen, setSheetOpen] = useState(false)
  const [bidError, setBidError] = useState<string | null>(null)
  const [outbidFlash, setOutbidFlash] = useState(false)
  const [tournamentStatus, setTournamentStatus] = useState(tournament.status)
  const [submittingBid, setSubmittingBid] = useState(false)
  const supabaseRef = useRef(createRealtimeClient())
  const prevWinnerRef = useRef<string | null>(
    initialSession?.winning_bidder_team_id ?? null
  )

  const teamMap = useMemo(() => new Map(teams.map((t) => [t.id, t])), [teams])
  const currentTeam = useMemo(
    () => (currentTeamId ? teamMap.get(currentTeamId) ?? null : null),
    [currentTeamId, teamMap]
  )
  const winningTeam = useMemo(
    () =>
      session?.winning_bidder_team_id
        ? teamMap.get(session.winning_bidder_team_id) ?? null
        : null,
    [session?.winning_bidder_team_id, teamMap]
  )

  const isMyTeamUp = currentTeamId === me.id
  const iAmWinning = session?.winning_bidder_team_id === me.id

  const minBidCents = useMemo(() => {
    if (!session) return 0
    return (
      (session.current_bid_cents || 0) +
      (tournament.min_bid_increment_cents || 5000)
    )
  }, [session, tournament.min_bid_increment_cents])

  // Detect outbid flash
  useEffect(() => {
    const winnerId = session?.winning_bidder_team_id ?? null
    if (
      prevWinnerRef.current === me.id &&
      winnerId &&
      winnerId !== me.id
    ) {
      setOutbidFlash(true)
      const t = setTimeout(() => setOutbidFlash(false), 2500)
      return () => clearTimeout(t)
    }
    prevWinnerRef.current = winnerId
  }, [session?.winning_bidder_team_id, me.id])

  const applyEvent = useCallback(
    (event: RealtimeAuctionEvent) => {
      switch (event.type) {
        case 'bid:placed':
        case 'bid:placed_extended': {
          setSession((prev) =>
            prev
              ? {
                  ...prev,
                  current_bid_cents: event.current_bid_cents,
                  winning_bidder_team_id: event.winning_bidder_team_id,
                  timer_started_at: event.timer_started_at,
                  timer_duration_seconds: event.timer_duration_seconds,
                  extension_count: event.extension_count,
                  status: 'active',
                }
              : prev
          )
          setBids((prev) => {
            // Dedup by id
            if (event.bid?.id && prev.some((b) => b.id === event.bid.id)) {
              return prev
            }
            return [event.bid, ...prev].slice(0, 10)
          })
          break
        }
        case 'auction:team_started': {
          setSession(event.auction_session)
          setCurrentTeamId(event.team.id)
          setBids([])
          setTeams((prev) =>
            prev.map((t) =>
              t.id === event.team.id ? { ...t, auction_status: 'active' } : t
            )
          )
          break
        }
        case 'auction:team_sold': {
          setSession(event.auction_session)
          setTeams((prev) =>
            prev.map((t) =>
              t.id === event.team.id
                ? {
                    ...t,
                    auction_status: 'sold',
                    final_sale_price_cents: event.final_amount_cents,
                  }
                : t
            )
          )
          break
        }
        case 'auction:team_passed': {
          setSession(event.auction_session)
          setTeams((prev) =>
            prev.map((t) =>
              t.id === event.team.id ? { ...t, auction_status: 'passed' } : t
            )
          )
          break
        }
        case 'auction:completed': {
          setSession(null)
          setCurrentTeamId(null)
          setTournamentStatus('complete')
          break
        }
      }
    },
    []
  )

  // Subscribe to Realtime
  useEffect(() => {
    const supabase = supabaseRef.current
    const channel = supabase.channel(`auction:${tournament.id}`)
    const events = [
      'bid:placed',
      'bid:placed_extended',
      'auction:team_started',
      'auction:team_sold',
      'auction:team_passed',
      'auction:completed',
    ]
    events.forEach((evt) => {
      channel.on('broadcast', { event: evt }, (msg) => {
        applyEvent({ type: evt, ...msg.payload } as RealtimeAuctionEvent)
      })
    })
    channel.subscribe((status) => {
      setConnected(status === 'SUBSCRIBED')
    })
    return () => {
      supabase.removeChannel(channel)
    }
  }, [tournament.id, applyEvent])

  // Polling fallback
  useEffect(() => {
    const interval = setInterval(async () => {
      try {
        const res = await fetch('/api/play/state', { cache: 'no-store' })
        if (!res.ok) return
        const data = await res.json()
        if (data.tournament_status) setTournamentStatus(data.tournament_status)
        if (data.session !== undefined) {
          setSession(data.session)
          setCurrentTeamId(data.session?.team_id ?? null)
        }
        if (Array.isArray(data.recent_bids)) {
          // Strip the joined bidder_team field — we use teamMap for lookups
          setBids(
            data.recent_bids.map((b: any) => ({
              id: b.id,
              auction_session_id: b.auction_session_id,
              bidder_team_id: b.bidder_team_id,
              amount_cents: b.amount_cents,
              is_winning: b.is_winning,
              created_at: b.created_at,
            }))
          )
        }
      } catch {}
    }, 5000)
    return () => clearInterval(interval)
  }, [])

  // Live timer
  const [remaining, setRemaining] = useState<number>(
    session
      ? computeTimerRemaining(session.timer_started_at, session.timer_duration_seconds)
      : 0
  )
  useEffect(() => {
    if (!session?.timer_started_at) {
      setRemaining(session?.timer_duration_seconds ?? 0)
      return
    }
    const tick = () => {
      setRemaining(
        computeTimerRemaining(session.timer_started_at, session.timer_duration_seconds)
      )
    }
    tick()
    const interval = setInterval(tick, 250)
    return () => clearInterval(interval)
  }, [session?.timer_started_at, session?.timer_duration_seconds])

  async function placeBid(amountCents: number) {
    setBidError(null)
    setSubmittingBid(true)
    try {
      const res = await fetch('/api/play/bid', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount_cents: amountCents }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        const err = data.error || 'BID_FAILED'
        const messages: Record<string, string> = {
          BID_TOO_LOW: `Bid too low. Minimum is ${formatCents(minBidCents)}.`,
          ALREADY_WINNING: 'You are already the leading bidder.',
          TIMER_EXPIRED: 'Time expired. Bid not accepted.',
          AUCTION_NOT_ACTIVE: 'No active auction.',
          INVALID_BIDDER: 'You cannot bid on your own team.',
        }
        setBidError(messages[err] || 'Bid failed. Please try again.')
        return false
      }
      setSheetOpen(false)
      return true
    } catch {
      setBidError('Network error. Please try again.')
      return false
    } finally {
      setSubmittingBid(false)
    }
  }

  async function signOut() {
    await fetch('/api/play/auth', { method: 'DELETE' })
    router.push('/play')
    router.refresh()
  }

  const isActive = session?.status === 'active'
  const isAuctionComplete =
    tournamentStatus === 'auction_complete' ||
    tournamentStatus === 'complete' ||
    tournamentStatus === 'results_pending'

  // Timer ring
  const totalSeconds = session?.timer_duration_seconds ?? 30
  const circumference = 2 * Math.PI * 52
  const dashOffset = Math.max(
    0,
    circumference * (1 - remaining / Math.max(1, totalSeconds))
  )

  const isUrgent = remaining <= 10 && remaining > 0 && isActive

  return (
    <div className="min-h-dvh flex flex-col bg-[#020617] text-white">
      <PlayerHeader
        tournament={tournament}
        connected={connected}
        meTeam={me}
        onSignOut={signOut}
      />

      <div className="flex-1 overflow-y-auto pb-24">
        {!isActive && !currentTeam ? (
          <EmptyState
            title={isAuctionComplete ? 'Auction Complete' : 'Auction Not Started'}
            subtitle={
              isAuctionComplete
                ? 'Check back for results soon.'
                : 'The auction will begin shortly. Hang tight!'
            }
          />
        ) : (
          <div className="px-4 py-5 space-y-5 max-w-md mx-auto w-full">
            {/* Current team card */}
            {currentTeam && (
              <div className="rounded-2xl bg-slate-800/80 border border-slate-700 p-5">
                <span className="block text-[10px] font-bold uppercase tracking-[0.25em] text-primary-400 mb-2">
                  Up for Auction
                </span>
                <h2 className="text-2xl font-bold leading-tight">
                  {currentTeam.player1_name.toUpperCase()} /{' '}
                  {currentTeam.player2_name.toUpperCase()}
                </h2>
                <div className="mt-3 flex flex-wrap gap-2">
                  {currentTeam.player1_handicap_index !== null && (
                    <span className="rounded-full bg-slate-700/60 px-3 py-1 text-xs font-medium text-slate-200">
                      HCP {formatHandicap(currentTeam.player1_handicap_index)}
                    </span>
                  )}
                  {currentTeam.player2_handicap_index !== null && (
                    <span className="rounded-full bg-slate-700/60 px-3 py-1 text-xs font-medium text-slate-200">
                      HCP {formatHandicap(currentTeam.player2_handicap_index)}
                    </span>
                  )}
                </div>
                {isMyTeamUp && (
                  <div className="mt-3 inline-block rounded-md bg-yellow-900/40 border border-yellow-700/50 px-2.5 py-1 text-xs font-semibold text-yellow-300">
                    This is your team — you cannot bid
                  </div>
                )}
              </div>
            )}

            {/* Timer ring */}
            {isActive && session && (
              <div className="flex justify-center">
                <div className="relative w-32 h-32">
                  <svg viewBox="0 0 120 120" className="w-full h-full -rotate-90">
                    <circle
                      cx="60"
                      cy="60"
                      r="52"
                      fill="none"
                      stroke="#1e293b"
                      strokeWidth="6"
                    />
                    <circle
                      cx="60"
                      cy="60"
                      r="52"
                      fill="none"
                      stroke={isUrgent ? '#eab308' : '#22c55e'}
                      strokeWidth="6"
                      strokeLinecap="round"
                      strokeDasharray={circumference}
                      strokeDashoffset={dashOffset}
                      style={{ transition: 'stroke-dashoffset 250ms linear' }}
                    />
                  </svg>
                  <div className="absolute inset-0 flex flex-col items-center justify-center">
                    <span
                      className={`text-4xl font-bold tabular-nums ${
                        isUrgent ? 'text-yellow-400 animate-pulse' : 'text-white'
                      }`}
                    >
                      {remaining}
                    </span>
                    <span className="text-[10px] uppercase tracking-widest text-slate-400">
                      seconds
                    </span>
                  </div>
                  {session.extension_count > 0 && (
                    <div className="absolute -top-1 -right-1 rounded-full bg-yellow-500 px-2 py-0.5 text-[10px] font-bold text-black">
                      +{session.extension_count}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Current bid */}
            {session && (
              <div className="text-center">
                <p className="text-[10px] uppercase tracking-[0.25em] text-slate-500 mb-1">
                  Current Bid
                </p>
                <p className="text-5xl font-bold tabular-nums text-primary-400">
                  {formatCents(session.current_bid_cents)}
                </p>
                {winningTeam ? (
                  <p
                    className={`mt-1 text-sm ${
                      iAmWinning ? 'text-primary-400 font-semibold' : 'text-slate-400'
                    }`}
                  >
                    {iAmWinning
                      ? 'You are leading'
                      : `Leading: ${winningTeam.player1_name} / ${winningTeam.player2_name}`}
                  </p>
                ) : (
                  <p className="mt-1 text-sm text-slate-500">No bids yet</p>
                )}
                {isActive && (
                  <p className="mt-1 text-xs text-slate-500">
                    Next min bid: {formatCents(minBidCents)}
                  </p>
                )}
              </div>
            )}

            {/* Place bid button */}
            {isActive && !isMyTeamUp && (
              <button
                onClick={() => {
                  setBidError(null)
                  setSheetOpen(true)
                }}
                disabled={iAmWinning}
                className="w-full rounded-2xl bg-primary-600 hover:bg-primary-500 disabled:bg-slate-700 disabled:text-slate-500 text-white font-bold text-lg tracking-wider py-5 transition-colors shadow-lg shadow-primary-900/40"
              >
                {iAmWinning ? 'YOU ARE LEADING' : 'PLACE BID'}
              </button>
            )}

            {session?.status === 'sold' && (
              <div className="rounded-xl border border-primary-700/50 bg-primary-900/30 px-4 py-3 text-center">
                <p className="text-2xl font-bold text-primary-400">SOLD</p>
                <p className="text-sm text-slate-300 mt-1">
                  {formatCents(session.current_bid_cents)}
                  {winningTeam && (
                    <> to {winningTeam.player1_name} / {winningTeam.player2_name}</>
                  )}
                </p>
              </div>
            )}

            {session?.status === 'passed' && (
              <div className="rounded-xl border border-slate-700 bg-slate-800/40 px-4 py-3 text-center text-slate-400 font-semibold">
                PASSED
              </div>
            )}

            {/* Recent bids */}
            {bids.length > 0 && (
              <div>
                <h3 className="text-xs font-semibold uppercase tracking-widest text-slate-500 mb-2">
                  Recent Bids
                </h3>
                <div className="space-y-2">
                  {bids.slice(0, 5).map((b) => {
                    const t = teamMap.get(b.bidder_team_id)
                    const mine = b.bidder_team_id === me.id
                    return (
                      <div
                        key={b.id}
                        className={`flex items-center justify-between rounded-lg px-3 py-2.5 ${
                          mine
                            ? 'bg-primary-900/30 border border-primary-700/40'
                            : 'bg-slate-800/60'
                        }`}
                      >
                        <span className="text-sm truncate">
                          {t
                            ? `${t.player1_name} / ${t.player2_name}`
                            : 'Unknown team'}
                          {mine && (
                            <span className="ml-1.5 text-[10px] uppercase tracking-wider text-primary-400">
                              You
                            </span>
                          )}
                        </span>
                        <span className="font-mono font-semibold text-sm text-primary-300 tabular-nums flex-shrink-0">
                          {formatCents(b.amount_cents)}
                        </span>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Outbid toast */}
      {outbidFlash && (
        <div className="fixed left-1/2 top-20 z-40 -translate-x-1/2 rounded-full bg-red-600 px-5 py-2 text-sm font-bold text-white shadow-lg animate-fade-in">
          ! OUTBID
        </div>
      )}

      <BidSheet
        open={sheetOpen}
        onClose={() => setSheetOpen(false)}
        minBidCents={minBidCents}
        onSubmit={placeBid}
        error={bidError}
        submitting={submittingBid}
      />

      <PlayerTabBar active="auction" />
    </div>
  )
}

function EmptyState({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <div className="flex-1 flex flex-col items-center justify-center px-8 py-20 text-center">
      <svg width="64" height="64" viewBox="0 0 80 80" fill="none" className="mb-4 opacity-60">
        <ellipse cx="40" cy="52" rx="28" ry="12" fill="#16a34a" opacity="0.25" />
        <line x1="44" y1="14" x2="44" y2="52" stroke="#94a3b8" strokeWidth="2.5" strokeLinecap="round" />
        <path d="M44 14 L44 28 L28 21 Z" fill="#16a34a" />
        <circle cx="44" cy="52" r="3" fill="#94a3b8" />
      </svg>
      <h2 className="text-2xl font-bold text-slate-300">{title}</h2>
      <p className="mt-2 text-sm text-slate-500 max-w-xs">{subtitle}</p>
    </div>
  )
}
