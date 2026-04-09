// Auction control API — all auction state mutations route through here
// so the admin client bypasses RLS reliably.
import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { getAuthUser } from '@/lib/auth'

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  const user = await getAuthUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const db   = createAdminClient()
  const body = await request.json()
  const { action } = body
  const tournamentId = params.id

  const { data: admin } = await db.from('tournament_admins').select('role')
    .eq('tournament_id', tournamentId).eq('admin_id', user.id).single()
  if (!admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  switch (action) {
    case 'create_and_start': {
      const { teamId, openingBidCents, timerDurationSeconds } = body
      const now = new Date().toISOString()
      // Delete existing pending session if any
      await db.from('auction_sessions').delete().eq('team_id', teamId).eq('status', 'pending')
      const { data: session, error } = await db.from('auction_sessions').insert({
        tournament_id: tournamentId, team_id: teamId,
        status: 'active', opening_bid_cents: openingBidCents ?? 0,
        current_bid_cents: openingBidCents ?? 0, winning_bidder_team_id: null,
        timer_started_at: now, timer_duration_seconds: timerDurationSeconds ?? 30,
        extension_count: 0, sold_at: null,
      }).select().single()
      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
      await db.from('tournaments').update({ current_auction_session_id: session.id, status: 'auction_live' }).eq('id', tournamentId)
      await db.from('teams').update({ auction_status: 'active' }).eq('id', teamId)
      return NextResponse.json(session)
    }
        case 'start_session': {
      const { sessionId, openingBidCents } = body
      const { data, error } = await db.rpc('start_auction_session', {
        p_session_id: sessionId, p_opening_bid_cents: openingBidCents ?? 0,
      })
      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
      return NextResponse.json(data)
    }
    case 'close_session': {
      const { sessionId } = body
      const { data, error } = await db.rpc('close_auction_session', { p_session_id: sessionId })
      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
      return NextResponse.json(data)
    }
    case 'update_tournament_status': {
      const { status } = body
      const { data, error } = await db.from('tournaments').update({ status }).eq('id', tournamentId).select().single()
      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
      return NextResponse.json(data)
    }
    case 'set_current_session': {
      const { sessionId } = body
      await db.from('tournaments').update({ current_auction_session_id: sessionId }).eq('id', tournamentId)
      return NextResponse.json({ success: true })
    }
    case 'update_team_status': {
      const { teamId, auctionStatus } = body
      await db.from('teams').update({ auction_status: auctionStatus }).eq('id', teamId)
      return NextResponse.json({ success: true })
    }
    case 'record_sale': {
      const { sessionId, teamId, salePriceCents, winnerTeamId } = body
      await db.from('auction_sessions').update({
        status: 'sold', current_bid_cents: salePriceCents,
        winning_bidder_team_id: winnerTeamId, sold_at: new Date().toISOString(),
      }).eq('id', sessionId)
      await db.from('teams').update({ auction_status: 'sold', final_sale_price_cents: salePriceCents }).eq('id', teamId)
      await db.from('ownerships').insert({
        auction_session_id: sessionId, team_id: teamId, owner_team_id: winnerTeamId,
        ownership_type: 'purchase', ownership_percentage: 100, amount_paid_cents: salePriceCents, payment_confirmed: false,
      })
      await db.from('tournaments').update({ current_auction_session_id: null }).eq('id', tournamentId)
      return NextResponse.json({ success: true })
    }
    case 'record_pass': {
      const { sessionId, teamId } = body
      await db.from('auction_sessions').update({ status: 'passed' }).eq('id', sessionId)
      await db.from('teams').update({ auction_status: 'passed' }).eq('id', teamId)
      await db.from('tournaments').update({ current_auction_session_id: null }).eq('id', tournamentId)
      return NextResponse.json({ success: true })
    }
    default:
      return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 })
  }
}
