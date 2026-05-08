// Resets the stress test tournament's auction session — clears bids,
// resets bid amount to $100, restarts timer. Hardcoded to ONLY work
// on the STRESS TEST 50 USERS tournament.
import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'

const STRESS_TEST_TOURNAMENT_ID = '1b34bbe8-5d30-4755-b040-8bb878315bca'

export async function POST(_req: NextRequest) {
  const db = createAdminClient()

  // Get current session
  const { data: tournament } = await db
    .from('tournaments')
    .select('current_auction_session_id')
    .eq('id', STRESS_TEST_TOURNAMENT_ID)
    .single()

  const sessionId = tournament?.current_auction_session_id
  if (!sessionId) return NextResponse.json({ error: 'no active session' }, { status: 404 })

  // Clear bids
  await db.from('bids').delete().eq('auction_session_id', sessionId)

  // Reset session — use 120s timer so the test has plenty of headroom
  const { data, error } = await db
    .from('auction_sessions')
    .update({
      status: 'active',
      current_bid_cents: 10000,
      winning_bidder_team_id: null,
      timer_started_at: new Date().toISOString(),
      timer_duration_seconds: 120,
      extension_count: 0,
      sold_at: null,
    })
    .eq('id', sessionId)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true, session: data })
}
