import { notFound, redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import type { Flight, FlightPayoutTier } from '@/types/database'
import FlightsClient from './FlightsClient'
import type { Metadata } from 'next'

export const dynamic = 'force-dynamic'
export const revalidate = 0

interface Props {
  params: { id: string }
}

export const metadata: Metadata = { title: 'Flights & Payouts' }

export default async function FlightsPage({ params }: Props) {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/auth/login')

  const { data: tournament } = await supabase
    .from('tournaments')
    .select('id, name, status')
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

  const { data: flights } = await supabase
    .from('flights')
    .select('*')
    .eq('tournament_id', params.id)
    .order('display_order')

  const flightList = (flights as Flight[] | null) ?? []

  // Fetch all payout tiers for these flights
  let payoutTiers: FlightPayoutTier[] = []
  if (flightList.length > 0) {
    const { data: tiers } = await supabase
      .from('flight_payout_tiers')
      .select('*')
      .in(
        'flight_id',
        flightList.map((f) => f.id)
      )
      .order('place')
    payoutTiers = (tiers as FlightPayoutTier[] | null) ?? []
  }

  return (
    <FlightsClient
      tournamentId={params.id}
      tournamentName={tournament.name}
      tournamentStatus={tournament.status}
      initialFlights={flightList}
      initialPayoutTiers={payoutTiers}
    />
  )
}
