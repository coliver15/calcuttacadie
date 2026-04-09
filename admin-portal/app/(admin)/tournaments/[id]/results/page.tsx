import { notFound, redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import type { Tournament, Team, Flight, FlightPayoutTier, Ownership } from '@/types/database'
import ResultsClient from './ResultsClient'
import type { Metadata } from 'next'

interface Props {
  params: { id: string }
}

export const metadata: Metadata = { title: 'Final Results' }

export default async function ResultsPage({ params }: Props) {
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
      .order('auction_order'),
    supabase
      .from('flights')
      .select('*')
      .eq('tournament_id', params.id)
      .order('display_order'),
  ])

  const flightList = (flights as Flight[] | null) ?? []
  const teamList = (teams as Team[] | null) ?? []

  // Fetch payout tiers for all flights
  let payoutTiers: FlightPayoutTier[] = []
  if (flightList.length > 0) {
    const { data: tiers } = await supabase
      .from('flight_payout_tiers')
      .select('*')
      .in('flight_id', flightList.map((f) => f.id))
      .order('place')
    payoutTiers = (tiers as FlightPayoutTier[] | null) ?? []
  }

  // Fetch ownership records for sold teams
  const soldTeamIds = teamList.filter((t) => t.auction_status === 'sold').map((t) => t.id)
  let ownerships: Ownership[] = []
  if (soldTeamIds.length > 0) {
    const { data: owns } = await supabase
      .from('ownerships')
      .select('*')
      .in('team_id', soldTeamIds)
    ownerships = (owns as Ownership[] | null) ?? []
  }

  return (
    <ResultsClient
      tournament={tournament as Tournament}
      teams={teamList}
      flights={flightList}
      payoutTiers={payoutTiers}
      ownerships={ownerships}
    />
  )
}
