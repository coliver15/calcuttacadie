import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { getAuthUser } from '@/lib/auth'

// PATCH — save final placements for all teams in a flight
export async function PATCH(request: NextRequest) {
  const user = await getAuthUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const db   = createAdminClient()
  const body = await request.json()
  const { tournamentId, placements } = body
  // placements: [{ teamId, place }]
  const { data: admin } = await db.from('tournament_admins').select('role')
    .eq('tournament_id', tournamentId).eq('admin_id', user.id).single()
  if (!admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  for (const { teamId, place } of placements) {
    await db.from('teams').update({ final_place: place }).eq('id', teamId)
  }
  return NextResponse.json({ success: true })
}

// POST — calculate winnings for a flight
export async function POST(request: NextRequest) {
  const user = await getAuthUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const db   = createAdminClient()
  const body = await request.json()
  const { flightId } = body
  const { data: flight } = await db.from('flights').select('tournament_id').eq('id', flightId).single()
  if (!flight) return NextResponse.json({ error: 'Flight not found' }, { status: 404 })
  const { data: admin } = await db.from('tournament_admins').select('role')
    .eq('tournament_id', flight.tournament_id).eq('admin_id', user.id).single()
  if (!admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  const { data, error } = await db.rpc('calculate_flight_winnings', { p_flight_id: flightId })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}
