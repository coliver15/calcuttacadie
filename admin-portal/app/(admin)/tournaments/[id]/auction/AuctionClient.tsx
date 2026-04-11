'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import AuctionTimer from '@/components/auction/AuctionTimer'
import BidFeed from '@/components/auction/BidFeed'
import AuctionControls from '@/components/auction/AuctionControls'
import TeamCard from '@/components/auction/TeamCard'
import { Badge } from '@/components/ui/Badge'
import { formatCents } from '@/lib/utils'
import type {
  Tournament,
  Team,
  Flight,
  AuctionSession,
  Bid,
  BidWithTeam,
  RealtimeAuctionEvent,
} from '@/types/database'

interface AuctionClientProps {
  tournament: Tournament
  teams: Team[]
  flights: Flight[]
  initialSession: AuctionSession | null
  initialBids: Bid[]
}

export default function AuctionClient({
  tournament,
  teams: initialTeams,
  flights,
  initialSession,
  initialBids,
}: AuctionClientProps) {
  const [teams, setTeams] = useState<Team[]>(initialTeams)
  const [session, setSession] = useState<AuctionSession | null>(initialSession)
  const [bids, setBids] = useState<BidWithTeam[]>(initialBids as BidWithTeam[])
  const [connected, setConnected] = useState(false)

  const tournamentId = tournament.id

  async function auctionApi(action: string, extra: Record<string, unknown> = {}) {
    const res = await fetch(`/api/auction/${tournamentId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action, ...extra }),
    })
    if (!res.ok) { const d = await res.json(); throw new Error(d.error || action + ' failed') }
    return res.json()
  }

  const supabaseRef = useRef(createClient())
  const channelRef = useRef<ReturnType<ReturnType<typeof createClient>['channel']> | null>(null)

  const flightMap = new Map(flights.map((f) => [f.id, f]))
  const teamMap = new Map(teams.map((t) => [t.id, t]))

  // Current team from session
  const currentTeam = session?.team_id ? teamMap.get(session.team_id) ?? null : null

  // Teams list with statuses
  const pendingTeams = teams.filter((t) => t.auction_status === 'pending')
  const soldTeams = teams.filter((t) => t.auction_status === 'sold')
  const passedTeams = teams.filter((t) => t.auction_status === 'passed')

  // Subscribe to Supabase Realtime — store channel in ref for broadcasting
  useEffect(() => {
    const supabase = supabaseRef.current
    const channel = supabase.channel(`auction:${tournament.id}`)
    channelRef.current = channel

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
        handleRealtimeEvent({ type: evt, ...msg.payload } as RealtimeAuctionEvent)
      })
    })

    channel.subscribe((status) => {
      console.log('[Auction] Realtime status:', status)
      setConnected(status === 'SUBSCRIBED')
    })

    return () => {
      supabase.removeChannel(channel)
      channelRef.current = null
    }
  }, [tournament.id])

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
            setBids((prev) => [bidWithTeam, ...prev].slice(0, 50))
          }
          break
        }
        case 'auction:team_started': {
          setSession(event.auction_session)
          setBids([])
          setTeams((prev) =>
            prev.map((t) =>
              t.id === event.team.id ? { ...t, auction_status: 'active' as const } : t
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

  // Admin action: start bidding on a team
  async function handleStartBidding(openingBidCents: number) {
    // Always pick the first pending team — never re-auction a sold/passed team
    const nextTeam = pendingTeams[0]
    if (!nextTeam) throw new Error('No teams available to auction')

    // Create auction session via server API
    const newSession = await auctionApi('create_and_start', {
      teamId: nextTeam.id,
      openingBidCents,
      timerDurationSeconds: tournament.timer_duration_seconds,
    })

    setSession(newSession as AuctionSession)
    setTeams((prev) =>
      prev.map((t) =>
        t.id === nextTeam.id ? { ...t, auction_status: 'active' as const } : t
      )
    )
    setBids([])

    // Broadcast to display clients via the subscribed channel
    const channel = channelRef.current
    if (channel) {
      await channel.send({
        type: 'broadcast',
        event: 'auction:team_started',
        payload: {
          auction_session: newSession,
          team: nextTeam,
        },
      })
    }
  }

  // Admin action: close current bidding and advance to next team
  async function handleCloseAndAdvance() {
    if (!session || !currentTeam) throw new Error('No active session')

    const soldTeamId = currentTeam.id
    const salePriceCents = session.current_bid_cents
    const winnerTeamId = session.winning_bidder_team_id

    // Record sale via server API
    await auctionApi('record_sale', {
      sessionId: session.id,
      teamId: soldTeamId,
      salePriceCents,
      winnerTeamId,
    })

    // Update local teams state — mark as sold
    setTeams((prev) =>
      prev.map((t) =>
        t.id === soldTeamId
          ? {
              ...t,
              auction_status: 'sold' as const,
              final_sale_price_cents: salePriceCents,
            }
          : t
      )
    )

    // Broadcast sold event to display
    const channel = channelRef.current
    if (channel) {
      await channel.send({
        type: 'broadcast',
        event: 'auction:team_sold',
        payload: {
          auction_session: { ...session, status: 'sold' },
          team: currentTeam,
          winning_bidder_team_id: winnerTeamId,
          final_amount_cents: salePriceCents,
        },
      })
    }

    // Clear session so currentTeam resets — then auto-advance
    setSession(null)
    setBids([])
  }

  // Admin action: pass team (no sale)
  async function handlePassTeam() {
    if (!session || !currentTeam) throw new Error('No active session')

    const passedTeamId = currentTeam.id

    await auctionApi('record_pass', { sessionId: session.id, teamId: passedTeamId })

    setTeams((prev) =>
      prev.map((t) =>
        t.id === passedTeamId
          ? { ...t, auction_status: 'passed' as const }
          : t
      )
    )

    // Broadcast pass event to display
    const channel = channelRef.current
    if (channel) {
      await channel.send({
        type: 'broadcast',
        event: 'auction:team_passed',
        payload: { auction_session: { ...session, status: 'passed' }, team: currentTeam },
      })
    }

    // Clear session so currentTeam resets — ready for next team
    setSession(null)
    setBids([])
  }

  const isAuctionRunnable =
    tournament.status !== 'complete' &&
    tournament.status !== 'draft'

  return (
    <div className="px-4 sm:px-6 lg:px-8 py-6">
      {/* Breadcrumb + status */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-6">
        <div className="flex items-center gap-2 text-sm text-slate-500">
          <Link href="/dashboard" className="hover:text-slate-300 transition-colors">
            Tournaments
          </Link>
          <span>/</span>
          <Link
            href={`/tournaments/${tournament.id}`}
            className="hover:text-slate-300 transition-colors truncate"
          >
            {tournament.name}
          </Link>
          <span>/</span>
          <span className="text-slate-300">Auction</span>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant={connected ? 'success' : 'slate'}>
            <span className={`h-1.5 w-1.5 rounded-full ${connected ? 'bg-primary-400' : 'bg-slate-500'}`} />
            {connected ? 'Live' : 'Connecting…'}
          </Badge>
          <Link
            href={`/display/${tournament.id}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-slate-400 hover:text-slate-200 underline underline-offset-2"
          >
            📺 Open Display
          </Link>
        </div>
      </div>

      {!isAuctionRunnable && (
        <div className="mb-6 rounded-xl border border-yellow-700/50 bg-yellow-900/20 px-4 py-3 text-sm text-yellow-300">
          This tournament is in <strong>{tournament.status}</strong> status. Publish the tournament to run the auction.
        </div>
      )}

      <div className="grid lg:grid-cols-3 gap-5">
        {/* Left: Controls + Timer + Bid Feed */}
        <div className="lg:col-span-2 space-y-5">
          {/* Current team */}
          {currentTeam ? (
            <div>
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">
                Currently Up for Auction
              </p>
              <TeamCard
                team={currentTeam}
                flight={currentTeam.flight_id ? flightMap.get(currentTeam.flight_id) : null}
                currentBidCents={session?.current_bid_cents}
                showBid
                size="lg"
                highlight={session?.status === 'active'}
              />
            </div>
          ) : (
            <div className="rounded-xl border border-slate-700 bg-slate-900 p-8 text-center text-slate-400">
              {pendingTeams.length > 0
                ? `${pendingTeams.length} teams ready to auction. Start bidding to begin.`
                : 'All teams have been auctioned.'}
            </div>
          )}

          {/* Timer */}
          {session && session.status === 'active' && (
            <div className="flex flex-col items-center justify-center rounded-xl border border-slate-700 bg-slate-900 py-8">
              <AuctionTimer
                timerStartedAt={session.timer_started_at}
                timerDurationSeconds={session.timer_duration_seconds}
                size="lg"
              />
              {session.extension_count > 0 && (
                <p className="text-xs text-yellow-400 mt-2">
                  Extended {session.extension_count}×
                </p>
              )}
            </div>
          )}

          {/* Controls */}
          {isAuctionRunnable && (
            <AuctionControls
              session={session}
              currentTeam={currentTeam ?? pendingTeams[0] ?? null}
              minBidIncrementCents={tournament.min_bid_increment_cents}
              onStartBidding={handleStartBidding}
              onCloseAndAdvance={handleCloseAndAdvance}
              onPassTeam={handlePassTeam}
            />
          )}

          {/* Bid feed */}
          <div>
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">
              Recent Bids
            </p>
            <BidFeed bids={bids} />
          </div>
        </div>

        {/* Right: Team list */}
        <div className="space-y-4">
          {/* Stats */}
          <div className="grid grid-cols-3 gap-2">
            <div className="stat-card py-3">
              <span className="stat-label text-[10px]">Pending</span>
              <span className="stat-value text-xl">{pendingTeams.length}</span>
            </div>
            <div className="stat-card py-3">
              <span className="stat-label text-[10px]">Sold</span>
              <span className="stat-value text-xl text-primary-400">{soldTeams.length}</span>
            </div>
            <div className="stat-card py-3">
              <span className="stat-label text-[10px]">Passed</span>
              <span className="stat-value text-xl text-slate-500">{passedTeams.length}</span>
            </div>
          </div>

          {/* Pot total */}
          <div className="stat-card">
            <span className="stat-label">Total Pot</span>
            <span className="stat-value text-primary-400">
              {formatCents(soldTeams.reduce((s, t) => s + (t.final_sale_price_cents ?? 0), 0))}
            </span>
          </div>

          {/* All teams list */}
          <div className="rounded-xl border border-slate-700 bg-slate-900 overflow-hidden">
            <div className="px-4 py-3 border-b border-slate-700">
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                All Teams ({teams.length})
              </p>
            </div>
            <div className="divide-y divide-slate-800 max-h-[60vh] overflow-y-auto">
              {teams.map((team) => (
                <div
                  key={team.id}
                  className={`px-4 py-3 flex items-center justify-between gap-2 ${
                    team.auction_status === 'active'
                      ? 'bg-primary-900/20'
                      : ''
                  }`}
                >
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-white truncate">
                      {team.player1_name}
                    </p>
                    <p className="text-xs text-slate-400 truncate">
                      {team.player2_name}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    {team.final_sale_price_cents !== null && (
                      <span className="text-xs font-mono text-primary-300">
                        {formatCents(team.final_sale_price_cents)}
                      </span>
                    )}
                    <Badge
                      variant={
                        team.auction_status === 'active'
                          ? 'success'
                          : team.auction_status === 'sold'
                          ? 'info'
                          : team.auction_status === 'passed'
                          ? 'default'
                          : 'slate'
                      }
                    >
                      {team.auction_status === 'active' && (
                        <span className="h-1.5 w-1.5 rounded-full bg-primary-400 animate-pulse" />
                      )}
                      {team.auction_status}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
