'use client'

import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import AuctionTimer from '@/components/auction/AuctionTimer'
import { formatCents, formatHandicap } from '@/lib/utils'
import type {
  Tournament,
  Team,
  Flight,
  AuctionSession,
  Bid,
  BidWithTeam,
  RealtimeAuctionEvent,
} from '@/types/database'

interface DisplayClientProps {
  tournament: Tournament
  teams: Team[]
  flights: Flight[]
  initialSession: AuctionSession | null
  initialBids: Bid[]
}

export default function DisplayClient({
  tournament,
  teams: initialTeams,
  flights,
  initialSession,
  initialBids,
}: DisplayClientProps) {
  const [teams, setTeams] = useState<Team[]>(initialTeams)
  const [session, setSession] = useState<AuctionSession | null>(initialSession)
  const [bids, setBids] = useState<BidWithTeam[]>(initialBids as BidWithTeam[])
  const [connected, setConnected] = useState(false)
  const supabaseRef = useRef(createClient())

  const teamMap   = useMemo(() => new Map(teams.map((t) => [t.id, t])), [teams])
  const flightMap = useMemo(() => new Map(flights.map((f) => [f.id, f])), [flights])

  const currentTeam = useMemo(() => session?.team_id ? teamMap.get(session.team_id) ?? null : null, [session?.team_id, teamMap])

  const soldTeams  = useMemo(() => teams.filter((t) => t.auction_status === 'sold'), [teams])
  const pendingCount = useMemo(() => teams.filter((t) => t.auction_status === 'pending').length, [teams])
  const totalPot     = useMemo(() => soldTeams.reduce((s, t) => s + (t.final_sale_price_cents ?? 0), 0), [soldTeams])

  const handleRealtimeEvent = useCallback(
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
                }
              : prev
          )
          const bidderTeam = teamMap.get(event.bid.bidder_team_id)
          if (bidderTeam) {
            const bidWithTeam: BidWithTeam = {
              ...event.bid,
              bidder_team: {
                id: bidderTeam.id,
                player1_name: bidderTeam.player1_name,
                player2_name: bidderTeam.player2_name,
              },
            }
            setBids((prev) => [bidWithTeam, ...prev].slice(0, 10))
          }
          break
        }
        case 'auction:team_started': {
          setSession(event.auction_session)
          setBids([])
          setTeams((prev) =>
            prev.map((t) =>
              t.id === event.team.id
                ? { ...t, auction_status: 'active' as const }
                : t
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
                    auction_status: 'sold' as const,
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
              t.id === event.team.id
                ? { ...t, auction_status: 'passed' as const }
                : t
            )
          )
          break
        }
        case 'auction:completed': {
          setSession(null)
          break
        }
      }
    },
    [teamMap]
  )

  useEffect(() => {
    const supabase = supabaseRef.current
    const channel = supabase.channel(`auction:${tournament.id}`)

    channel
      .on('broadcast', { event: '*' }, ({ event, payload }) => {
        handleRealtimeEvent({ type: event, ...payload } as RealtimeAuctionEvent)
      })
      .subscribe((status) => {
        setConnected(status === 'SUBSCRIBED')
      })

    return () => {
      supabase.removeChannel(channel)
    }
  }, [tournament.id, handleRealtimeEvent])

  const winningTeam = session?.winning_bidder_team_id
    ? teamMap.get(session.winning_bidder_team_id)
    : null

  const currentFlight = currentTeam?.flight_id
    ? flightMap.get(currentTeam.flight_id)
    : null

  const isActive = session?.status === 'active'

  return (
    <div className="min-h-screen bg-[#020617] text-white select-none overflow-hidden">
      {/* Top bar */}
      <div className="flex items-center justify-between px-8 py-4 border-b border-slate-800">
        <div className="flex items-center gap-4">
          {/* Logo */}
          <svg width="40" height="40" viewBox="0 0 32 32" fill="none">
            <circle cx="16" cy="16" r="15" fill="#052e16" stroke="#16a34a" strokeWidth="1.5" />
            <path d="M10 24V9" stroke="#16a34a" strokeWidth="2" strokeLinecap="round" />
            <path d="M10 9l9 3-9 3z" fill="#16a34a" />
            <rect x="17" y="18" width="7" height="3" rx="1" fill="#4ade80" transform="rotate(-35 20 19)" />
            <path d="M20 22l2.5 2.5" stroke="#4ade80" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
          <div>
            <p className="text-2xl font-bold leading-none">{tournament.name}</p>
            <p className="text-sm text-slate-400 mt-0.5">
              {tournament.club_name}
              {tournament.club_location && ` · ${tournament.club_location}`}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-6 text-right">
          <div>
            <p className="text-xs text-slate-500 uppercase tracking-wider">Total Pot</p>
            <p className="text-2xl font-bold tabular-nums text-primary-400">
              {formatCents(totalPot)}
            </p>
          </div>
          <div>
            <p className="text-xs text-slate-500 uppercase tracking-wider">Remaining</p>
            <p className="text-2xl font-bold tabular-nums">{pendingCount}</p>
          </div>
          <div
            className={`flex items-center gap-2 text-sm ${
              connected ? 'text-primary-400' : 'text-slate-500'
            }`}
          >
            <span
              className={`h-2 w-2 rounded-full ${
                connected ? 'bg-primary-400 animate-pulse-green' : 'bg-slate-600'
              }`}
            />
            {connected ? 'Live' : 'Connecting…'}
          </div>
        </div>
      </div>

      {/* Main content */}
      <div className="flex h-[calc(100vh-80px)]">
        {/* Center: Current team + bid */}
        <div className="flex-1 flex flex-col items-center justify-center px-8 py-8 gap-6">
          {!currentTeam && !isActive ? (
            <div className="text-center">
              <p className="text-6xl font-bold text-slate-600 mb-4">
                {teams.length === 0 ? 'No Teams' : 'Auction Not Started'}
              </p>
              <p className="text-2xl text-slate-500">
                {tournament.name}
              </p>
            </div>
          ) : (
            <>
              {/* Flight badge */}
              {currentFlight && (
                <div className="rounded-full border border-slate-700 bg-slate-800 px-5 py-2 text-lg font-semibold text-slate-300">
                  {currentFlight.name}
                </div>
              )}

              {/* Players */}
              <div className="text-center">
                <p className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-500 mb-4">
                  Up for Auction
                </p>
                <div className="space-y-2">
                  <div className="flex items-baseline justify-center gap-4">
                    <span className="text-6xl font-bold tracking-tight">
                      {currentTeam?.player1_name}
                    </span>
                    {currentTeam?.player1_handicap_index !== null && (
                      <span className="text-3xl text-slate-400 font-mono">
                        {formatHandicap(currentTeam?.player1_handicap_index ?? null)}
                      </span>
                    )}
                  </div>
                  <div className="text-4xl font-medium text-slate-400">&amp;</div>
                  <div className="flex items-baseline justify-center gap-4">
                    <span className="text-6xl font-bold tracking-tight">
                      {currentTeam?.player2_name}
                    </span>
                    {currentTeam?.player2_handicap_index !== null && (
                      <span className="text-3xl text-slate-400 font-mono">
                        {formatHandicap(currentTeam?.player2_handicap_index ?? null)}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Current bid */}
              {isActive && session && (
                <div className="text-center">
                  <p className="text-sm uppercase tracking-widest text-slate-500 mb-2">
                    Current Bid
                  </p>
                  <p className="text-8xl font-bold tabular-nums text-primary-400">
                    {formatCents(session.current_bid_cents)}
                  </p>
                  {winningTeam && (
                    <p className="text-xl text-slate-400 mt-2">
                      {winningTeam.player1_name} / {winningTeam.player2_name}
                    </p>
                  )}
                </div>
              )}

              {/* Timer */}
              {isActive && session && (
                <div className="relative">
                  <AuctionTimer
                    timerStartedAt={session.timer_started_at}
                    timerDurationSeconds={session.timer_duration_seconds}
                    size="xl"
                  />
                  {session.extension_count > 0 && (
                    <div className="absolute -top-2 -right-8">
                      <span className="rounded-full bg-yellow-600 px-2.5 py-1 text-xs font-bold text-black">
                        +{session.extension_count}
                      </span>
                    </div>
                  )}
                </div>
              )}

              {/* Sold indicator */}
              {session?.status === 'sold' && (
                <div className="text-center">
                  <p className="text-6xl font-bold text-primary-400">SOLD!</p>
                  <p className="text-4xl font-bold text-white mt-2">
                    {formatCents(session.current_bid_cents)}
                  </p>
                  {winningTeam && (
                    <p className="text-2xl text-slate-300 mt-2">
                      to {winningTeam.player1_name} / {winningTeam.player2_name}
                    </p>
                  )}
                </div>
              )}

              {/* Passed indicator */}
              {session?.status === 'passed' && (
                <div className="text-center">
                  <p className="text-5xl font-bold text-slate-500">PASSED</p>
                </div>
              )}
            </>
          )}
        </div>

        {/* Right: Recent bids + sold teams */}
        <div className="w-80 border-l border-slate-800 flex flex-col">
          {/* Bid feed */}
          {bids.length > 0 && (
            <div className="flex-1 overflow-y-auto px-4 py-4">
              <p className="text-xs uppercase tracking-widest text-slate-500 mb-3">
                Recent Bids
              </p>
              <div className="space-y-2">
                {bids.map((bid, index) => (
                  <div
                    key={bid.id}
                    className={`flex items-center justify-between gap-2 rounded-lg px-3 py-2 ${
                      index === 0 && bid.is_winning
                        ? 'bg-primary-900/40 border border-primary-700/50'
                        : 'bg-slate-800/50'
                    }`}
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-white truncate">
                        {bid.bidder_team.player1_name}
                      </p>
                      <p className="text-xs text-slate-400 truncate">
                        {bid.bidder_team.player2_name}
                      </p>
                    </div>
                    <span className="font-mono font-semibold text-sm text-primary-300 flex-shrink-0">
                      {formatCents(bid.amount_cents)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Recently sold */}
          {soldTeams.length > 0 && (
            <div className="border-t border-slate-800 px-4 py-4 max-h-64 overflow-y-auto">
              <p className="text-xs uppercase tracking-widest text-slate-500 mb-3">
                Sold ({soldTeams.length})
              </p>
              <div className="space-y-2">
                {soldTeams
                  .slice()
                  .reverse()
                  .map((team) => (
                    <div
                      key={team.id}
                      className="flex items-center justify-between gap-2"
                    >
                      <div className="min-w-0">
                        <p className="text-sm text-slate-300 truncate">
                          {team.player1_name} / {team.player2_name}
                        </p>
                      </div>
                      <span className="text-xs font-mono text-primary-400 flex-shrink-0">
                        {formatCents(team.final_sale_price_cents ?? 0)}
                      </span>
                    </div>
                  ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
