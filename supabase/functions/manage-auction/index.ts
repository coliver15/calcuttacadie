// manage-auction Edge Function
// Admin-only. Drives the auction state machine.
// Requires valid admin JWT (verify_jwt = true).
//
// POST body: { action: string, ...params }
//
// Actions:
//   start_tournament_auction  — moves tournament to auction_live, randomizes order if needed
//   start_team_session        — begins bidding on a specific team (session_id, opening_bid_cents)
//   close_team_session        — closes current session (timer validation happens in DB function)
//   next_team                 — closes current + starts next pending session automatically
//   end_auction               — marks tournament auction_complete
//   set_team_order            — manually set auction order for teams (teams: [{team_id, order}])
//   set_opening_bid           — set opening bid for a pending session

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders, handleCors, jsonResponse, errorResponse } from '../_shared/cors.ts'

const serviceSupabase = () => createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
)

Deno.serve(async (req) => {
  const corsResponse = handleCors(req)
  if (corsResponse) return corsResponse

  try {
    const authHeader = req.headers.get('authorization')
    if (!authHeader) return errorResponse('Missing authorization header', 401)

    const userClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } }
    )

    const { data: { user }, error: authError } = await userClient.auth.getUser()
    if (authError || !user) return errorResponse('Unauthorized', 401)

    const db = serviceSupabase()
    const body = await req.json()
    const { action, tournament_id } = body

    if (!action || !tournament_id) {
      return errorResponse('action and tournament_id are required', 400)
    }

    // Verify caller is an admin for this tournament
    const { data: adminCheck } = await db
      .from('tournament_admins')
      .select('role')
      .eq('tournament_id', tournament_id)
      .eq('admin_id', user.id)
      .single()

    if (!adminCheck) {
      return errorResponse('You are not an admin for this tournament', 403)
    }

    switch (action) {

      // ── Start the auction phase ──────────────────────────────
      case 'start_tournament_auction': {
        const { data: tournament } = await db
          .from('tournaments')
          .select('status, auction_order_type')
          .eq('id', tournament_id)
          .single()

        if (!tournament || tournament.status !== 'ready') {
          return errorResponse('Tournament must be in "ready" status to start auction', 409)
        }

        // Randomize auction order if set to random
        if (tournament.auction_order_type === 'random') {
          const { data: teams } = await db
            .from('teams')
            .select('id')
            .eq('tournament_id', tournament_id)
            .order('created_at')

          if (teams && teams.length > 0) {
            const shuffled = teams
              .map((t, i) => ({ id: t.id, sort: Math.random() }))
              .sort((a, b) => a.sort - b.sort)

            for (let i = 0; i < shuffled.length; i++) {
              await db.from('teams').update({ auction_order: i + 1 }).eq('id', shuffled[i].id)
            }
          }
        }

        await db.from('tournaments')
          .update({ status: 'auction_live', updated_at: new Date().toISOString() })
          .eq('id', tournament_id)

        await broadcastToTournament(tournament_id, {
          event: 'auction:started',
          payload: { tournament_id, timestamp: new Date().toISOString() }
        })

        return jsonResponse({ success: true, status: 'auction_live' })
      }

      // ── Start bidding on a specific team ────────────────────
      case 'start_team_session': {
        const { session_id, opening_bid_cents = 0 } = body

        if (!session_id) return errorResponse('session_id is required', 400)

        const { data: result, error } = await db
          .rpc('start_auction_session', {
            p_session_id: session_id,
            p_opening_bid_cents: opening_bid_cents,
          })

        if (error) {
          const msg = error.message ?? ''
          if (msg.includes('SESSION_NOT_PENDING'))  return errorResponse('Session is not pending', 409)
          if (msg.includes('TOURNAMENT_NOT_LIVE'))  return errorResponse('Tournament is not live', 409)
          return errorResponse('Failed to start session: ' + msg, 500)
        }

        // Get team info for the broadcast
        const { data: session } = await db
          .from('auction_sessions')
          .select('team_id, teams(player1_name, player2_name, flight_id)')
          .eq('id', session_id)
          .single()

        await broadcastToTournament(tournament_id, {
          event: 'auction:team_started',
          payload: {
            session_id,
            team_id: (session as any)?.team_id,
            team: (session as any)?.teams,
            opening_bid_cents,
            timer_started_at: result.timer_started_at,
            timer_duration_seconds: result.timer_duration_seconds,
          }
        })

        return jsonResponse(result)
      }

      // ── Close the current team session ──────────────────────
      case 'close_team_session': {
        const { session_id } = body
        if (!session_id) return errorResponse('session_id is required', 400)

        const { data: result, error } = await db
          .rpc('close_auction_session', { p_session_id: session_id })

        if (error) {
          const msg = error.message ?? ''
          if (msg.includes('TIMER_NOT_EXPIRED')) return errorResponse('Timer has not expired yet', 409)
          if (msg.includes('SESSION_NOT_ACTIVE')) return errorResponse('Session is not active', 409)
          return errorResponse('Failed to close session: ' + msg, 500)
        }

        // Broadcast sold/passed event
        await broadcastToTournament(tournament_id, {
          event: result.status === 'sold' ? 'auction:team_sold' : 'auction:team_passed',
          payload: {
            session_id,
            team_id: result.team_id,
            status: result.status,
            sale_price_cents: result.sale_price_cents ?? null,
            winning_bidder_team_id: result.winning_bidder_team_id ?? null,
          }
        })

        // If sold: signal buyback prompt to the sold team
        if (result.status === 'sold') {
          await broadcastToTournament(tournament_id, {
            event: 'buyback:available',
            payload: {
              session_id,
              team_id: result.team_id,
              sale_price_cents: result.sale_price_cents,
              buyback_amount_cents: Math.floor(result.sale_price_cents / 2),
            }
          })
        }

        // Clear tournament's current session pointer
        await db.from('tournaments')
          .update({ current_auction_session_id: null, updated_at: new Date().toISOString() })
          .eq('id', tournament_id)

        return jsonResponse(result)
      }

      // ── Auto-advance to next team in order ──────────────────
      case 'next_team': {
        // Find the next pending session ordered by teams.auction_order
        const { data: nextSession } = await db
          .from('auction_sessions')
          .select('id, team_id, teams(auction_order, player1_name, player2_name)')
          .eq('tournament_id', tournament_id)
          .eq('status', 'pending')
          .order('teams(auction_order)', { ascending: true })
          .limit(1)
          .single()

        if (!nextSession) {
          // No more teams — end the auction
          await db.from('tournaments')
            .update({ status: 'auction_complete', updated_at: new Date().toISOString() })
            .eq('id', tournament_id)

          await broadcastToTournament(tournament_id, {
            event: 'auction:completed',
            payload: { tournament_id, timestamp: new Date().toISOString() }
          })

          return jsonResponse({ success: true, status: 'auction_complete', next_session: null })
        }

        return jsonResponse({
          success: true,
          next_session_id: (nextSession as any).id,
          next_team_id: (nextSession as any).team_id,
          next_team: (nextSession as any).teams,
        })
      }

      // ── Manually set team auction order ─────────────────────
      case 'set_team_order': {
        const { teams } = body  // [{ team_id: string, order: number }]
        if (!Array.isArray(teams)) return errorResponse('teams must be an array', 400)

        for (const { team_id, order } of teams) {
          await db.from('teams')
            .update({ auction_order: order, updated_at: new Date().toISOString() })
            .eq('id', team_id)
            .eq('tournament_id', tournament_id)
        }

        return jsonResponse({ success: true, count: teams.length })
      }

      // ── Set opening bid for a pending session ───────────────
      case 'set_opening_bid': {
        const { session_id, opening_bid_cents } = body
        if (!session_id || opening_bid_cents === undefined) {
          return errorResponse('session_id and opening_bid_cents are required', 400)
        }

        await db.from('auction_sessions')
          .update({ opening_bid_cents, updated_at: new Date().toISOString() })
          .eq('id', session_id)
          .eq('status', 'pending')

        return jsonResponse({ success: true })
      }

      // ── End auction manually (all sessions processed) ───────
      case 'end_auction': {
        await db.from('tournaments')
          .update({ status: 'auction_complete', updated_at: new Date().toISOString() })
          .eq('id', tournament_id)

        await broadcastToTournament(tournament_id, {
          event: 'auction:completed',
          payload: { tournament_id, timestamp: new Date().toISOString() }
        })

        return jsonResponse({ success: true, status: 'auction_complete' })
      }

      default:
        return errorResponse(`Unknown action: ${action}`, 400)
    }
  } catch (err) {
    console.error('manage-auction error:', err)
    return errorResponse('Internal server error', 500)
  }
})

async function broadcastToTournament(
  tournamentId: string,
  message: { event: string; payload: Record<string, unknown> }
) {
  try {
    await fetch(`${Deno.env.get('SUPABASE_URL')}/realtime/v1/api/broadcast`, {
      method: 'POST',
      headers: {
        'Content-Type':  'application/json',
        'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`,
        'apikey':        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
      },
      body: JSON.stringify({
        messages: [{
          topic:   `auction:${tournamentId}`,
          event:   message.event,
          payload: message.payload,
        }]
      }),
    })
  } catch (err) {
    console.error('Realtime broadcast failed:', err)
  }
}
