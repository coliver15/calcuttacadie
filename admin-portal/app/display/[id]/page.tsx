import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import type { Tournament, Team, Flight, AuctionSession, Bid } from '@/types/database'
import DisplayClient from './DisplayClient'

interface Props {
  params: { id: string }
}

export default async function DisplayPage({ params }: Props) {
  const supabase = createClient()

  const { data: tournament } = await supabase
    .from('tournaments')
    .select('*')
    .eq('id', params.id)
    .single()

  if (!tournament) notFound()

  const [{ data: teams }, { data: flights }] = await Promise.all([
    supabase
      .from('teams')
      .select('*')
      .eq('tournament_id', params.id)
      .order('auction_order'),
    supabase
      .from('flights')
      .select('*')
      .eq('tournament_id', params.id)
      .order('display_order'),
  ])

  let currentSession: AuctionSession | null = null
  let recentBids: Bid[] = []

  if ((tournament as Tournament).current_auction_session_id) {
    const { data: session } = await supabase
      .from('auction_sessions')
      .select('*')
      .eq('id', (tournament as Tournament).current_auction_session_id)
      .single()
    currentSession = session as AuctionSession | null

    if (currentSession) {
      const { data: bids } = await supabase
        .from('bids')
        .select('*, bidder_team:teams(id, player1_name, player2_name)')
        .eq('auction_session_id', currentSession.id)
        .order('created_at', { ascending: false })
        .limit(10)
      recentBids = (bids as Bid[] | null) ?? []
    }
  }

  return (
    <DisplayClient
      tournament={tournament as Tournament}
      teams={(teams as Team[] | null) ?? []}
      flights={(flights as Flight[] | null) ?? []}
      initialSession={currentSession}
      initialBids={recentBids}
    />
  )
}
