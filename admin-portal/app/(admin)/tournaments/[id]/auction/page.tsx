import { notFound, redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import type { Tournament, Team, Flight, AuctionSession, Bid } from '@/types/database'
import AuctionClient from './AuctionClient'
import type { Metadata } from 'next'

interface Props {
  params: { id: string }
}

export const metadata: Metadata = { title: 'Live Auction' }

export default async function AuctionPage({ params }: Props) {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/auth/login')

  const { data: tournament } = await supabase
    .from('tournaments')
    .select('*')
    .eq('id', params.id)
    .single()

  if (!tournament) notFound()

  const { data: adminRecord } = await supabase
    .from('tournament_admins')
    .select('role')
    .eq('tournament_id', params.id)
    .eq('admin_id', user.id)
    .single()

  if (!adminRecord) notFound()

  const [{ data: teams }, { data: flights }] = await Promise.all([
    supabase
      .from('teams')
      .select('*')
      .eq('tournament_id', params.id)
      .order('auction_order', { ascending: true }),
    supabase
      .from('flights')
      .select('*')
      .eq('tournament_id', params.id)
      .order('display_order'),
  ])

  // Load current auction session if exists
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
        .limit(30)
      recentBids = (bids as Bid[] | null) ?? []
    }
  }

  return (
    <AuctionClient
      tournament={tournament as Tournament}
      teams={(teams as Team[] | null) ?? []}
      flights={(flights as Flight[] | null) ?? []}
      initialSession={currentSession}
      initialBids={recentBids}
    />
  )
}
