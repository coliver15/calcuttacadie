// validate-access-code Edge Function
// Public endpoint — no JWT required.
// Validates a team's access code and returns a scoped JWT for bidding portal use.
//
// POST body: { access_code: string }
// Returns:   { token: string, team: { id, player1_name, player2_name, tournament } }
//
// The returned JWT includes:
//   sub:           team.id  (so auth.uid() = team_id in RLS)
//   role:          'authenticated'
//   team_id:       team.id
//   tournament_id: team.tournament_id
//   user_role:     'team_guest'

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import * as jose from 'https://deno.land/x/jose@v4.15.4/index.ts'
import { corsHeaders, handleCors, jsonResponse, errorResponse } from '../_shared/cors.ts'

const VALID_TOURNAMENT_STATUSES = [
  'setup', 'ready', 'auction_live', 'auction_complete', 'results_pending', 'complete'
]

Deno.serve(async (req) => {
  const corsResponse = handleCors(req)
  if (corsResponse) return corsResponse

  try {
    const { access_code } = await req.json()

    if (!access_code || typeof access_code !== 'string') {
      return errorResponse('access_code is required', 400)
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    // Look up team by access code (case-insensitive, normalize to uppercase)
    const { data: team, error } = await supabase
      .from('teams')
      .select(`
        id,
        tournament_id,
        player1_name,
        player2_name,
        player1_handicap_index,
        player2_handicap_index,
        player1_id,
        player2_id,
        flight_id,
        auction_status,
        tournaments (
          id,
          name,
          club_name,
          club_location,
          tournament_date,
          status,
          timer_duration_seconds,
          timer_extension_seconds,
          timer_extension_threshold_seconds,
          min_bid_increment_cents
        )
      `)
      .eq('access_code', access_code.toUpperCase().trim())
      .single()

    if (error || !team) {
      return errorResponse('Invalid access code', 401)
    }

    const tournament = (team as any).tournaments
    if (!VALID_TOURNAMENT_STATUSES.includes(tournament.status)) {
      return errorResponse('Tournament is not yet active', 403)
    }

    // Build custom JWT payload
    const now = Math.floor(Date.now() / 1000)
    const payload = {
      iss: Deno.env.get('SUPABASE_URL'),
      sub: team.id,                    // auth.uid() will return team_id
      role: 'authenticated',
      team_id: team.id,
      tournament_id: team.tournament_id,
      user_role: 'team_guest',
      iat: now,
      exp: now + (24 * 60 * 60),       // 24-hour session
    }

    // Sign with Supabase JWT secret (HS256)
    const secret = new TextEncoder().encode(Deno.env.get('SUPABASE_JWT_SECRET')!)
    const token = await new jose.SignJWT(payload)
      .setProtectedHeader({ alg: 'HS256' })
      .sign(secret)

    return jsonResponse({
      token,
      team: {
        id: team.id,
        player1_name: team.player1_name,
        player2_name: team.player2_name,
        player1_handicap_index: (team as any).player1_handicap_index,
        player2_handicap_index: (team as any).player2_handicap_index,
        player1_id: (team as any).player1_id,
        player2_id: (team as any).player2_id,
        flight_id: (team as any).flight_id,
        auction_status: (team as any).auction_status,
        tournament,
      },
    })
  } catch (err) {
    console.error('validate-access-code error:', err)
    return errorResponse('Internal server error', 500)
  }
})
