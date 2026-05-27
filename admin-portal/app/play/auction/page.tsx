import { redirect } from 'next/navigation'
import { createAdminClient } from '@/lib/supabase/server'
import { getPlayerSession } from '@/lib/playerAuth'
import type {
  Tournament,
  Team,
  AuctionSession,
  Bid,
} from '@/types/database'
import PlayerAuctionClient from './PlayerAuctionClient'

export const dynamic = 'force-dynamic'

export default async function PlayerAuctionPage() {
  const session = getPlayerSession()
  if (!session) {
    redirect('/play')
  }

  const db = createAdminClient()

  const { data: tournament } = await db
    .from('tournaments')
    .select('*')
    .eq('id', session.tournament_id)
    .single()

  if (!tournament) {
    redirect('/play')
  }

  const { data: team } = await db
    .from('teams')
    .select('*')
    .eq('id', session.team_id)
    .single()

  if (!team) {
    redirect('/play')
  }

  const { data: teams } = await db
    .from('teams')
    .select('*')
    .eq('tournament_id', session.tournament_id)

  let initialSession: AuctionSession | null = null
  let initialBids: Bid[] = []

  const t = tournament as Tournament
  if (t.current_auction_session_id) {
    const { data: sess } = await db
      .from('auction_sessions')
      .select('*')
      .eq('id', t.current_auction_session_id)
      .single()
    initialSession = sess as AuctionSession | null
    if (initialSession) {
      const { data: bids } = await db
        .from('bids')
        .select('*')
        .eq('auction_session_id', initialSession.id)
        .order('created_at', { ascending: false })
        .limit(10)
      initialBids = (bids as Bid[] | null) ?? []
    }
  }

  return (
    <PlayerAuctionClient
      tournament={t}
      me={team as Team}
      teams={(teams as Team[] | null) ?? []}
      initialSession={initialSession}
      initialBids={initialBids}
    />
  )
}
