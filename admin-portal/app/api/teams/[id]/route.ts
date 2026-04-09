import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { getAuthUser } from '@/lib/auth'

async function verifyAccess(db: any, teamId: string, userId: string) {
  const { data: team } = await db.from('teams').select('tournament_id').eq('id', teamId).single()
  if (!team) return false
  const { data: admin } = await db.from('tournament_admins').select('role')
    .eq('tournament_id', team.tournament_id).eq('admin_id', userId).single()
  return !!admin
}

export async function PUT(request: NextRequest, { params }: { params: { id: string } }) {
  const user = await getAuthUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const db = createAdminClient()
  if (!(await verifyAccess(db, params.id, user.id)))
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  const body = await request.json()
  const { data, error } = await db.from('teams').update({
    player1_name: body.player1_name, player2_name: body.player2_name,
    player1_handicap_index: body.player1_handicap_index ?? null,
    player2_handicap_index: body.player2_handicap_index ?? null,
    flight_id: body.flight_id || null,
  }).eq('id', params.id).select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
  const user = await getAuthUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const db = createAdminClient()
  if (!(await verifyAccess(db, params.id, user.id)))
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  const { data: team } = await db.from('teams').select('auction_status').eq('id', params.id).single()
  if (team?.auction_status === 'sold' || team?.auction_status === 'active')
    return NextResponse.json({ error: 'Cannot delete a team that has been bid on or sold.' }, { status: 409 })
  await db.from('auction_sessions').delete().eq('team_id', params.id)
  const { error } = await db.from('teams').delete().eq('id', params.id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
