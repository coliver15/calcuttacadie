import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { cookies } from 'next/headers'

async function getAuthUserId(): Promise<string | null> {
  const cookieStore = cookies()
  const session = cookieStore.get('cc-session')
  if (!session?.value) return null
  try {
    const parsed = JSON.parse(session.value)
    const res = await fetch(
      `${process.env.NEXT_PUBLIC_SUPABASE_URL!.trim()}/auth/v1/user`,
      { headers: { Authorization: `Bearer ${parsed.access_token}`, apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!.trim() }, cache: 'no-store' }
    )
    if (!res.ok) return null
    const u = await res.json()
    return u.id ?? null
  } catch { return null }
}

async function verifyTeamAccess(db: any, teamId: string, userId: string): Promise<boolean> {
  const { data: team } = await db.from('teams').select('tournament_id').eq('id', teamId).single()
  if (!team) return false
  const { data: admin } = await db
    .from('tournament_admins').select('role')
    .eq('tournament_id', team.tournament_id).eq('admin_id', userId).single()
  return !!admin
}

// PUT — update team
export async function PUT(request: NextRequest, { params }: { params: { id: string } }) {
  const userId = await getAuthUserId()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const db = createAdminClient()
  if (!(await verifyTeamAccess(db, params.id, userId))) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const body = await request.json()
  const { data: team, error } = await db
    .from('teams')
    .update({
      player1_name: body.player1_name,
      player2_name: body.player2_name,
      player1_handicap_index: body.player1_handicap_index ?? null,
      player2_handicap_index: body.player2_handicap_index ?? null,
      flight_id: body.flight_id || null,
    })
    .eq('id', params.id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(team)
}

// DELETE — remove team
export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
  const userId = await getAuthUserId()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const db = createAdminClient()
  if (!(await verifyTeamAccess(db, params.id, userId))) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { error } = await db.from('teams').delete().eq('id', params.id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
