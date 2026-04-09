// place-bid Edge Function
// Requires valid team JWT (verify_jwt = true in config.toml).
// Calls the place_bid() PL/pgSQL function which handles:
//   - Row-level locking (concurrency safety)
//   - Bid validation
//   - Timer expiry check
//   - Automatic timer extension
// Then broadcasts the bid event to all connected clients via Supabase Realtime.
//
// POST body: { session_id: string, amount_cents: number }

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders, handleCors, jsonResponse, errorResponse } from '../_shared/cors.ts'

Deno.serve(async (req) => {
  const corsResponse = handleCors(req)
  if (corsResponse) return corsResponse

  try {
    const authHeader = req.headers.get('authorization')
    if (!authHeader) return errorResponse('Missing authorization header', 401)

    // Parse the calling team's JWT to get team_id
    // Supabase client with the user's token will enforce RLS automatically
    const userSupabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } }
    )

    // Use service role for the actual bid operation (calls security definer function)
    const serviceSupabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    const { session_id, amount_cents } = await req.json()

    if (!session_id || !amount_cents) {
      return errorResponse('session_id and amount_cents are required', 400)
    }

    if (!Number.isInteger(amount_cents) || amount_cents <= 0) {
      return errorResponse('amount_cents must be a positive integer', 400)
    }

    // Get the calling team's identity from their JWT
    const { data: { user }, error: authError } = await userSupabase.auth.getUser()
    if (authError || !user) return errorResponse('Unauthorized', 401)

    // auth.uid() = team_id for team guests (set as sub in validate-access-code)
    const bidderTeamId = user.id

    // Validate the session exists and belongs to the bidder's tournament
    // This is a lightweight check before the heavier DB function
    const { data: session, error: sessionError } = await serviceSupabase
      .from('auction_sessions')
      .select('id, tournament_id, status, team_id')
      .eq('id', session_id)
      .single()

    if (sessionError || !session) {
      return errorResponse('Auction session not found', 404)
    }

    if (session.status !== 'active') {
      return errorResponse('Auction is not currently active', 409)
    }

    // Call the transactional bid function
    const { data: result, error: bidError } = await serviceSupabase
      .rpc('place_bid', {
        p_session_id:     session_id,
        p_bidder_team_id: bidderTeamId,
        p_amount_cents:   amount_cents,
      })

    if (bidError) {
      // Map DB exception messages to user-friendly errors
      const msg = bidError.message ?? ''
      if (msg.includes('AUCTION_NOT_ACTIVE'))  return errorResponse('Auction is no longer active', 409)
      if (msg.includes('INVALID_BIDDER'))       return errorResponse('Your team is not in this tournament', 403)
      if (msg.includes('ALREADY_WINNING'))      return errorResponse('You already have the winning bid', 409)
      if (msg.includes('BID_TOO_LOW'))          return errorResponse('Bid is too low — ' + msg.split('min_required: ')[1], 400)
      if (msg.includes('TIMER_EXPIRED'))        return errorResponse('Timer has expired', 409)
      console.error('place_bid DB error:', bidError)
      return errorResponse('Failed to place bid', 500)
    }

    // Broadcast to all clients watching this tournament's auction channel
    // Using Supabase Realtime Broadcast REST API for server-to-client push
    const broadcastPayload = {
      event: result.extended ? 'bid:placed_extended' : 'bid:placed',
      payload: {
        session_id,
        bidder_team_id:       bidderTeamId,
        amount_cents,
        extended:             result.extended,
        timer_started_at:     result.timer_started_at,
        timer_duration_seconds: result.timer_duration_seconds,
        timestamp:            new Date().toISOString(),
      }
    }

    await broadcastToTournament(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
      session.tournament_id,
      broadcastPayload
    )

    return jsonResponse({
      success: true,
      amount_cents,
      extended: result.extended,
      timer_started_at: result.timer_started_at,
      timer_duration_seconds: result.timer_duration_seconds,
    })
  } catch (err) {
    console.error('place-bid error:', err)
    return errorResponse('Internal server error', 500)
  }
})

// Broadcast a message to the tournament's Realtime channel
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
    // Non-fatal — bid is already committed to DB
    console.error('Realtime broadcast failed:', err)
  }
}
