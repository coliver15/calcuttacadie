import { redirect } from 'next/navigation'
import { createAdminClient } from '@/lib/supabase/server'
import { getPlayerSession } from '@/lib/playerAuth'
import type { Tournament, Team, Flight } from '@/types/database'
import PlayerPortfolioClient, { type PortfolioEntry } from './PlayerPortfolioClient'

export const dynamic = 'force-dynamic'

export default async function PortfolioPage() {
  const session = getPlayerSession()
  if (!session) {
    redirect('/play')
  }

  const db = createAdminClient()

  const [{ data: tournament }, { data: team }, { data: flights }] = await Promise.all([
    db.from('tournaments').select('*').eq('id', session.tournament_id).single(),
    db.from('teams').select('*').eq('id', session.team_id).single(),
    db.from('flights').select('*').eq('tournament_id', session.tournament_id),
  ])

  if (!tournament || !team) redirect('/play')

  // Fetch ownerships where this player's team is the OWNER (teams they own)
  const { data: ownerships } = await db
    .from('ownerships')
    .select('id, team_id, ownership_type, ownership_percentage, amount_paid_cents, payment_confirmed')
    .eq('owner_team_id', session.team_id)

  const ownedTeamIds = Array.from(
    new Set((ownerships ?? []).map((o) => o.team_id))
  )

  let ownedTeams: Team[] = []
  if (ownedTeamIds.length > 0) {
    const { data } = await db
      .from('teams')
      .select('*')
      .in('id', ownedTeamIds)
    ownedTeams = (data as Team[] | null) ?? []
  }

  const flightMap = new Map(((flights as Flight[] | null) ?? []).map((f) => [f.id, f]))
  const teamMap = new Map(ownedTeams.map((t) => [t.id, t]))

  // Estimate projected winnings as a rough multiplier of paid (3x for now — placeholder)
  const entries: PortfolioEntry[] = (ownerships ?? []).map((o) => {
    const t = teamMap.get(o.team_id)
    const flight = t?.flight_id ? flightMap.get(t.flight_id) : null
    const paid = o.amount_paid_cents ?? 0
    return {
      id: o.id,
      team_name: t
        ? `${t.player1_name} / ${t.player2_name}`
        : 'Unknown team',
      flight_name: flight?.name ?? null,
      ownership_percentage: Number(o.ownership_percentage),
      paid_cents: paid,
      projected_cents: Math.round(paid * 3),
      ownership_type: o.ownership_type as PortfolioEntry['ownership_type'],
      payment_confirmed: o.payment_confirmed,
    }
  })

  return (
    <PlayerPortfolioClient
      tournament={tournament as Tournament}
      me={team as Team}
      entries={entries}
    />
  )
}
