import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { getPlayerSession } from '@/lib/playerAuth'

export const dynamic = 'force-dynamic'

interface PlaceBidResult {
  extended?: boolean
  current_bid_cents?: number
  timer_started_at?: string
  timer_duration_seconds?: number
  extension_count?: number
  bid_id?: string
  [k: string]: unknown
}

function mapErrorStatus(msg: string): number {
  if (msg.includes('BID_TOO_LOW')) return 400
  if (msg.includes('ALREADY_WINNING')) return 409
  if (msg.includes('TIMER_EXPIRED')) return 409
  if (msg.includes('AUCTION_NOT_ACTIVE')) return 409
  if (msg.includes('INVALID_BIDDER')) return 403
  return 500
}

function parseErrorCode(msg: string): string {
  for (const code of [
    'BID_TOO_LOW',
    'ALREADY_WINNING',
    'TIMER_EXPIRED',
    'AUCTION_NOT_ACTIVE',
    'INVALID_BIDDER',
  ]) {
    if (msg.includes(code)) return code
  }
  return 'BID_FAILED'
}

export async function POST(req: NextRequest) {
  const session = getPlayerSession()
  if (!session) {
    return NextResponse.json({ error: 'UNAUTHENTICATED' }, { status: 401 })
  }

  let body: { amount_cents?: number }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'INVALID_BODY' }, { status: 400 })
  }
  const amount = Number(body.amount_cents)
  if (!Number.isInteger(amount) || amount <= 0) {
    return NextResponse.json({ error: 'INVALID_AMOUNT' }, { status: 400 })
  }

  const db = createAdminClient()

  // Look up the current auction session for the player's tournament
  const { data: tournament } = await db
    .from('tournaments')
    .select('id, current_auction_session_id')
    .eq('id', session.tournament_id)
    .single()

  if (!tournament?.current_auction_session_id) {
    return NextResponse.json({ error: 'AUCTION_NOT_ACTIVE' }, { status: 409 })
  }

  const { data: result, error } = await db.rpc('place_bid', {
    p_session_id: tournament.current_auction_session_id,
    p_bidder_team_id: session.team_id,
    p_amount_cents: amount,
  })

  if (error) {
    const msg = error.message || ''
    const code = parseErrorCode(msg)
    const status = mapErrorStatus(msg)
    return NextResponse.json({ error: code, message: msg }, { status })
  }

  const rpcResult = (result ?? {}) as PlaceBidResult

  // Fire-and-forget broadcast on Realtime channel so all connected clients update.
  // This is best-effort; if it fails, the polling fallback will catch up.
  const eventName = rpcResult.extended ? 'bid:placed_extended' : 'bid:placed'
  const broadcastPayload = {
    auction_session_id: tournament.current_auction_session_id,
    bid: {
      id: rpcResult.bid_id ?? null,
      auction_session_id: tournament.current_auction_session_id,
      bidder_team_id: session.team_id,
      amount_cents: amount,
      is_winning: true,
      created_at: new Date().toISOString(),
    },
    current_bid_cents: rpcResult.current_bid_cents ?? amount,
    winning_bidder_team_id: session.team_id,
    timer_started_at: rpcResult.timer_started_at ?? new Date().toISOString(),
    timer_duration_seconds: rpcResult.timer_duration_seconds ?? 30,
    extension_count: rpcResult.extension_count ?? 0,
    timestamp: Date.now(),
  }

  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!.trim()
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!.trim()
    await fetch(`${supabaseUrl}/realtime/v1/api/broadcast`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: serviceKey,
        Authorization: `Bearer ${serviceKey}`,
      },
      body: JSON.stringify({
        messages: [
          {
            topic: `auction:${session.tournament_id}`,
            event: eventName,
            payload: broadcastPayload,
            private: false,
          },
        ],
      }),
      cache: 'no-store',
    })
  } catch {
    // Swallow — Realtime broadcast is best-effort
  }

  return NextResponse.json({ ok: true, ...rpcResult })
}
