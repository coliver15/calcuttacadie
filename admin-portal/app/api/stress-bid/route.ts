// Stress-test only endpoint. Hardcoded to ONLY work for the
// STRESS TEST 50 USERS tournament. Goes through the same place_bid()
// stored procedure that the real Edge Function uses.
import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'

const STRESS_TEST_TOURNAMENT_ID = '1b34bbe8-5d30-4755-b040-8bb878315bca'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { session_id, bidder_team_id, amount_cents } = body
    if (!session_id || !bidder_team_id || !amount_cents) {
      return NextResponse.json({ error: 'missing fields' }, { status: 400 })
    }

    const db = createAdminClient()

    // Verify this is the stress test tournament
    const { data: session } = await db
      .from('auction_sessions')
      .select('id, tournament_id, status, current_bid_cents')
      .eq('id', session_id)
      .single()

    if (!session) return NextResponse.json({ error: 'session not found' }, { status: 404 })
    if (session.tournament_id !== STRESS_TEST_TOURNAMENT_ID) {
      return NextResponse.json({ error: 'forbidden — stress test only' }, { status: 403 })
    }

    // Call the same stored procedure the real Edge Function uses
    const { data: result, error } = await db.rpc('place_bid', {
      p_session_id: session_id,
      p_bidder_team_id: bidder_team_id,
      p_amount_cents: amount_cents,
    })

    if (error) {
      const msg = error.message || ''
      if (msg.includes('AUCTION_NOT_ACTIVE')) return NextResponse.json({ error: 'AUCTION_NOT_ACTIVE' }, { status: 409 })
      if (msg.includes('BID_TOO_LOW')) return NextResponse.json({ error: 'BID_TOO_LOW' }, { status: 400 })
      if (msg.includes('ALREADY_WINNING')) return NextResponse.json({ error: 'ALREADY_WINNING' }, { status: 409 })
      if (msg.includes('TIMER_EXPIRED')) return NextResponse.json({ error: 'TIMER_EXPIRED' }, { status: 409 })
      if (msg.includes('INVALID_BIDDER')) return NextResponse.json({ error: 'INVALID_BIDDER' }, { status: 403 })
      return NextResponse.json({ error: msg }, { status: 500 })
    }

    // Broadcast to the same channel the production app uses
    const channelName = `auction:${STRESS_TEST_TOURNAMENT_ID}`
    await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/realtime/v1/api/broadcast`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
        'apikey': process.env.SUPABASE_SERVICE_ROLE_KEY!,
      },
      body: JSON.stringify({
        messages: [{
          topic: channelName,
          event: result.extended ? 'bid:placed_extended' : 'bid:placed',
          payload: {
            session_id,
            bidder_team_id,
            amount_cents,
            timestamp: Date.now(),
          },
        }],
      }),
    }).catch(() => {})

    return NextResponse.json({ success: true, amount_cents, ...result })
  } catch (e: any) {
    return NextResponse.json({ error: e.message || 'internal error' }, { status: 500 })
  }
}
