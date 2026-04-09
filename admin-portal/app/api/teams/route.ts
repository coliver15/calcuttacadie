import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { getAuthUser } from '@/lib/auth'

export async function POST(request: NextRequest) {
  const user = await getAuthUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const db   = createAdminClient()
  const body = await request.json()
  const { tournamentId, ...teamData } = body

  const { data: admin } = await db
    .from('tournament_admins').select('role')
    .eq('tournament_id', tournamentId).eq('admin_id', user.id).single()
  if (!admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { count } = await db
    .from('teams').select('id', { count: 'exact', head: true })
    .eq('tournament_id', tournamentId)

  const { data: team, error } = await db.from('teams').insert({
    tournament_id: tournamentId,
    flight_id: teamData.flight_id || null,
    player1_name: teamData.player1_name,
    player2_name: teamData.player2_name,
    player1_handicap_index: teamData.player1_handicap_index ?? null,
    player2_handicap_index: teamData.player2_handicap_index ?? null,
    auction_order: (count ?? 0) + 1,
  }).select().single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(team)
}
