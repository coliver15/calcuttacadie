// Public display polling endpoint — no auth required (TV screens, projectors)
import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const db = createAdminClient()
  const tournamentId = params.id

  // Get tournament with current session
  const { data: tournament } = await db
    .from('tournaments')
    .select('current_auction_session_id')
    .eq('id', tournamentId)
    .single()

  // Get all teams
  const { data: teams } = await db
    .from('teams')
    .select('*')
    .eq('tournament_id', tournamentId)
    .order('auction_order', { ascending: true })

  // Get current session if any
  let session = null
  if (tournament?.current_auction_session_id) {
    const { data } = await db
      .from('auction_sessions')
      .select('*')
      .eq('id', tournament.current_auction_session_id)
      .single()
    session = data
  }

  return NextResponse.json({ teams: teams ?? [], session })
}
