import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { getPlayerSession } from '@/lib/playerAuth'

export const dynamic = 'force-dynamic'

export async function GET() {
  const playerSession = getPlayerSession()
  if (!playerSession) {
    return NextResponse.json({ error: 'UNAUTHENTICATED' }, { status: 401 })
  }

  const db = createAdminClient()

  const { data: tournament } = await db
    .from('tournaments')
    .select('id, status, current_auction_session_id')
    .eq('id', playerSession.tournament_id)
    .single()

  if (!tournament) {
    return NextResponse.json({ error: 'NOT_FOUND' }, { status: 404 })
  }

  let session = null
  let recent_bids: any[] = []
  let current_team = null

  if (tournament.current_auction_session_id) {
    const { data: sess } = await db
      .from('auction_sessions')
      .select('*')
      .eq('id', tournament.current_auction_session_id)
      .single()
    session = sess

    if (sess) {
      const [{ data: bids }, { data: team }] = await Promise.all([
        db
          .from('bids')
          .select('*, bidder_team:teams(id, player1_name, player2_name)')
          .eq('auction_session_id', sess.id)
          .order('created_at', { ascending: false })
          .limit(10),
        db
          .from('teams')
          .select('*')
          .eq('id', sess.team_id)
          .single(),
      ])
      recent_bids = bids ?? []
      current_team = team
    }
  }

  return NextResponse.json(
    {
      tournament_status: tournament.status,
      session,
      recent_bids,
      current_team,
    },
    { headers: { 'Cache-Control': 'no-store' } }
  )
}
