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

export async function POST(request: NextRequest) {
  const userId = await getAuthUserId()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const db   = createAdminClient()
  const body = await request.json()
  const { tournamentId, ...teamData } = body

  // Verify admin has access to this tournament
  const { data: admin } = await db
    .from('tournament_admins')
    .select('role')
    .eq('tournament_id', tournamentId)
    .eq('admin_id', userId)
    .single()
  if (!admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  // Get current team count for auction_order
  const { count } = await db
    .from('teams')
    .select('id', { count: 'exact', head: true })
    .eq('tournament_id', tournamentId)

  const { data: team, error } = await db
    .from('teams')
    .insert({
      tournament_id: tournamentId,
      flight_id: teamData.flight_id || null,
      player1_name: teamData.player1_name,
      player2_name: teamData.player2_name,
      player1_handicap_index: teamData.player1_handicap_index ?? null,
      player2_handicap_index: teamData.player2_handicap_index ?? null,
      auction_order: (count ?? 0) + 1,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(team)
}
