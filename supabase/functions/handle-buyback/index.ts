// handle-buyback Edge Function
// Handles both requesting and confirming a buyback.
// Requires valid team JWT (verify_jwt = true).
//
// Actions:
//   request  — sold team opts in to buy back 50% of their team
//              POST body: { action: 'request', session_id: string }
//
//   confirm  — winning bidder confirms they received cash payment
//              POST body: { action: 'confirm', buyback_request_id: string }
//
//   decline  — winning bidder declines (or sold team withdraws request)
//              POST body: { action: 'decline', buyback_request_id: string }

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders, handleCors, jsonResponse, errorResponse } from '../_shared/cors.ts'

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

    const callerTeamId = user.id  // auth.uid() = team_id for team guests

    const db = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    const body = await req.json()
    const { action } = body

    switch (action) {

      // ── Sold team requests a buyback ─────────────────────────
      case 'request': {
        const { session_id } = body
        if (!session_id) return errorResponse('session_id is required', 400)

        // Fetch the closed auction session
        const { data: session } = await db
          .from('auction_sessions')
          .select('id, team_id, tournament_id, status, current_bid_cents, winning_bidder_team_id')
          .eq('id', session_id)
          .single()

        if (!session) return errorResponse('Session not found', 404)
        if (session.status !== 'sold') return errorResponse('Team was not sold', 409)

        // Only the sold team itself can request a buyback
        if (session.team_id !== callerTeamId) {
          return errorResponse('Only the sold team can request a buyback', 403)
        }

        // Check no duplicate request
        const { data: existing } = await db
          .from('buyback_requests')
          .select('id, status')
          .eq('auction_session_id', session_id)
          .single()

        if (existing) {
          return errorResponse('A buyback request already exists for this session', 409)
        }

        const buybackAmount = Math.floor((session.current_bid_cents ?? 0) / 2)

        // Create the buyback request
        const { data: request, error: insertError } = await db
          .from('buyback_requests')
          .insert({
            auction_session_id:   session_id,
            requesting_team_id:   callerTeamId,
            amount_cents:         buybackAmount,
            status:               'pending',
          })
          .select()
          .single()

        if (insertError) {
          console.error('buyback insert error:', insertError)
          return errorResponse('Failed to create buyback request', 500)
        }

        // Notify the winning bidder via Realtime
        await broadcastToTournament(
          Deno.env.get('SUPABASE_URL')!,
          Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
          session.tournament_id,
          {
            event: 'buyback:requested',
            payload: {
              buyback_request_id: (request as any).id,
              session_id,
              requesting_team_id:      callerTeamId,
              winning_bidder_team_id:  session.winning_bidder_team_id,
              amount_cents:            buybackAmount,
            }
          }
        )

        return jsonResponse({
          success: true,
          buyback_request_id: (request as any).id,
          amount_cents: buybackAmount,
        })
      }

      // ── Winning bidder confirms cash received ────────────────
      case 'confirm': {
        const { buyback_request_id } = body
        if (!buyback_request_id) return errorResponse('buyback_request_id is required', 400)

        const { data: result, error } = await db
          .rpc('confirm_buyback', {
            p_buyback_request_id: buyback_request_id,
            p_confirming_team_id: callerTeamId,
          })

        if (error) {
          const msg = error.message ?? ''
          if (msg.includes('BUYBACK_NOT_FOUND'))   return errorResponse('Buyback request not found', 404)
          if (msg.includes('BUYBACK_NOT_PENDING')) return errorResponse('Buyback is not pending', 409)
          if (msg.includes('NOT_AUTHORIZED'))       return errorResponse('Only the winning bidder can confirm', 403)
          return errorResponse('Failed to confirm buyback: ' + msg, 500)
        }

        // Get session info for broadcast
        const { data: buyback } = await db
          .from('buyback_requests')
          .select('auction_session_id, requesting_team_id, auction_sessions(tournament_id)')
          .eq('id', buyback_request_id)
          .single()

        const tournamentId = (buyback as any)?.auction_sessions?.tournament_id

        if (tournamentId) {
          await broadcastToTournament(
            Deno.env.get('SUPABASE_URL')!,
            Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
            tournamentId,
            {
              event: 'buyback:confirmed',
              payload: {
                buyback_request_id,
                session_id: (buyback as any)?.auction_session_id,
                requesting_team_id: (buyback as any)?.requesting_team_id,
                confirmed_by_team_id: callerTeamId,
              }
            }
          )
        }

        return jsonResponse({ success: true, ...result })
      }

      // ── Decline or withdraw the buyback request ──────────────
      case 'decline': {
        const { buyback_request_id } = body
        if (!buyback_request_id) return errorResponse('buyback_request_id is required', 400)

        const { data: buyback } = await db
          .from('buyback_requests')
          .select('id, status, requesting_team_id, auction_session_id, auction_sessions(tournament_id, winning_bidder_team_id)')
          .eq('id', buyback_request_id)
          .single()

        if (!buyback) return errorResponse('Buyback request not found', 404)
        if ((buyback as any).status !== 'pending') return errorResponse('Buyback is not pending', 409)

        const winnerTeamId = (buyback as any).auction_sessions?.winning_bidder_team_id

        // Either the requesting team or the winning bidder can decline
        if (callerTeamId !== (buyback as any).requesting_team_id && callerTeamId !== winnerTeamId) {
          return errorResponse('Not authorized to decline this buyback', 403)
        }

        await db.from('buyback_requests')
          .update({ status: 'declined', updated_at: new Date().toISOString() })
          .eq('id', buyback_request_id)

        const tournamentId = (buyback as any).auction_sessions?.tournament_id
        if (tournamentId) {
          await broadcastToTournament(
            Deno.env.get('SUPABASE_URL')!,
            Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
            tournamentId,
            {
              event: 'buyback:declined',
              payload: { buyback_request_id, session_id: (buyback as any).auction_session_id }
            }
          )
        }

        return jsonResponse({ success: true })
      }

      default:
        return errorResponse(`Unknown action: ${action}`, 400)
    }
  } catch (err) {
    console.error('handle-buyback error:', err)
    return errorResponse('Internal server error', 500)
  }
})

async function broadcastToTournament(
  supabaseUrl: string,
  serviceRoleKey: string,
  tournamentId: string,
  message: { event: string; payload: Record<string, unknown> }
) {
  try {
    await fetch(`${supabaseUrl}/realtime/v1/api/broadcast`, {
      method: 'POST',
      headers: {
        'Content-Type':  'application/json',
        'Authorization': `Bearer ${serviceRoleKey}`,
        'apikey':        serviceRoleKey,
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
