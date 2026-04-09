// manage-ownership-group Edge Function
// Handles group ownership invitations.
// Requires valid team JWT (verify_jwt = true).
//
// Actions:
//   invite   — winning bidder invites up to 3 other teams to co-own
//              POST body: { action: 'invite', session_id, invited_team_id, percentage_offered }
//
//   accept   — invited team accepts the ownership share
//              POST body: { action: 'accept', invite_id }
//
//   decline  — invited team declines
//              POST body: { action: 'decline', invite_id }
//
//   cancel   — inviting team cancels a pending invite
//              POST body: { action: 'cancel', invite_id }
//
// Business rules enforced here:
//   - Max 4 total owners (inviter + 3 invitees)
//   - inviter must currently own 100% (before buyback) or 50% (after buyback)
//   - offered percentage cannot exceed inviter's current stake
//   - inviter cannot invite the sold team (they use buyback for that)
//   - inviter cannot invite themselves

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

    const callerTeamId = user.id

    const db = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    const body = await req.json()
    const { action } = body

    switch (action) {

      // ── Create an ownership group invite ────────────────────
      case 'invite': {
        const { session_id, invited_team_id, percentage_offered } = body

        if (!session_id || !invited_team_id || !percentage_offered) {
          return errorResponse('session_id, invited_team_id, and percentage_offered are required', 400)
        }

        if (typeof percentage_offered !== 'number' || percentage_offered <= 0 || percentage_offered >= 100) {
          return errorResponse('percentage_offered must be between 0 and 100 (exclusive)', 400)
        }

        // Inviter cannot invite themselves
        if (callerTeamId === invited_team_id) {
          return errorResponse('You cannot invite yourself', 400)
        }

        // Get session info
        const { data: session } = await db
          .from('auction_sessions')
          .select('id, tournament_id, team_id, status, winning_bidder_team_id')
          .eq('id', session_id)
          .single()

        if (!session) return errorResponse('Session not found', 404)
        if (session.status !== 'sold') return errorResponse('Team has not been sold yet', 409)

        // Only the winning bidder can create group invites
        if ((session as any).winning_bidder_team_id !== callerTeamId) {
          return errorResponse('Only the winning bidder can create group invites', 403)
        }

        // Cannot invite the sold team (they use buyback)
        if ((session as any).team_id === invited_team_id) {
          return errorResponse('The sold team uses the buyback mechanism, not group invites', 400)
        }

        // Ensure invited team is in the same tournament
        const { data: invitedTeam } = await db
          .from('teams')
          .select('id, tournament_id')
          .eq('id', invited_team_id)
          .eq('tournament_id', (session as any).tournament_id)
          .single()

        if (!invitedTeam) {
          return errorResponse('Invited team is not in this tournament', 404)
        }

        // Check max 4 owners (count existing accepted shares + pending invites)
        const { count: ownerCount } = await db
          .from('ownerships')
          .select('id', { count: 'exact' })
          .eq('auction_session_id', session_id)

        const { count: pendingInvites } = await db
          .from('ownership_group_invites')
          .select('id', { count: 'exact' })
          .eq('auction_session_id', session_id)
          .eq('status', 'pending')

        if ((ownerCount ?? 0) + (pendingInvites ?? 0) >= 4) {
          return errorResponse('Maximum of 4 owners per team reached', 409)
        }

        // Check inviter's current ownership stake
        const { data: primaryOwnership } = await db
          .from('ownerships')
          .select('id, ownership_percentage, amount_paid_cents')
          .eq('auction_session_id', session_id)
          .eq('owner_team_id', callerTeamId)
          .eq('ownership_type', 'purchase')
          .single()

        if (!primaryOwnership) {
          return errorResponse('Could not find your ownership record', 404)
        }

        // Account for already-offered percentages in pending invites
        const { data: existingInvites } = await db
          .from('ownership_group_invites')
          .select('percentage_offered')
          .eq('auction_session_id', session_id)
          .eq('status', 'pending')

        const alreadyOffered = (existingInvites ?? [])
          .reduce((sum, inv) => sum + inv.percentage_offered, 0)

        const availableToOffer = (primaryOwnership as any).ownership_percentage - alreadyOffered

        if (percentage_offered > availableToOffer) {
          return errorResponse(
            `You can only offer up to ${availableToOffer.toFixed(2)}% (your remaining unallocated stake)`,
            409
          )
        }

        // Check for duplicate invite to same team
        const { data: duplicateInvite } = await db
          .from('ownership_group_invites')
          .select('id, status')
          .eq('auction_session_id', session_id)
          .eq('invited_team_id', invited_team_id)
          .in('status', ['pending', 'accepted'])
          .single()

        if (duplicateInvite) {
          return errorResponse('An active invite already exists for this team', 409)
        }

        // Create the invite
        const { data: invite, error: inviteError } = await db
          .from('ownership_group_invites')
          .insert({
            primary_ownership_id: (primaryOwnership as any).id,
            auction_session_id:   session_id,
            invited_team_id,
            percentage_offered,
            status:               'pending',
          })
          .select()
          .single()

        if (inviteError) {
          console.error('invite insert error:', inviteError)
          return errorResponse('Failed to create invite', 500)
        }

        // Notify the invited team
        await broadcastToTournament(
          Deno.env.get('SUPABASE_URL')!,
          Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
          (session as any).tournament_id,
          {
            event: 'group:invite_received',
            payload: {
              invite_id:          (invite as any).id,
              session_id,
              inviting_team_id:   callerTeamId,
              invited_team_id,
              percentage_offered,
            }
          }
        )

        return jsonResponse({
          success: true,
          invite_id: (invite as any).id,
          percentage_offered,
        })
      }

      // ── Accept a group invite ────────────────────────────────
      case 'accept': {
        const { invite_id } = body
        if (!invite_id) return errorResponse('invite_id is required', 400)

        const { data: result, error } = await db
          .rpc('accept_group_invite', {
            p_invite_id:      invite_id,
            p_accepting_team: callerTeamId,
          })

        if (error) {
          const msg = error.message ?? ''
          if (msg.includes('INVITE_NOT_FOUND'))    return errorResponse('Invite not found', 404)
          if (msg.includes('NOT_AUTHORIZED'))       return errorResponse('This invite is not for your team', 403)
          if (msg.includes('INVITE_NOT_PENDING'))  return errorResponse('Invite is no longer pending', 409)
          if (msg.includes('INSUFFICIENT_OWNERSHIP')) return errorResponse('Inviter no longer has enough stake', 409)
          return errorResponse('Failed to accept invite: ' + msg, 500)
        }

        // Get invite details for broadcast
        const { data: invite } = await db
          .from('ownership_group_invites')
          .select('auction_session_id, invited_team_id, percentage_offered, auction_sessions(tournament_id)')
          .eq('id', invite_id)
          .single()

        const tournamentId = (invite as any)?.auction_sessions?.tournament_id
        if (tournamentId) {
          await broadcastToTournament(
            Deno.env.get('SUPABASE_URL')!,
            Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
            tournamentId,
            {
              event: 'group:invite_accepted',
              payload: {
                invite_id,
                session_id:         (invite as any).auction_session_id,
                accepted_team_id:   callerTeamId,
                percentage_accepted: (invite as any).percentage_offered,
              }
            }
          )
        }

        return jsonResponse({ success: true, ...result })
      }

      // ── Decline a group invite ───────────────────────────────
      case 'decline': {
        const { invite_id } = body
        if (!invite_id) return errorResponse('invite_id is required', 400)

        const { data: invite } = await db
          .from('ownership_group_invites')
          .select('id, status, invited_team_id, auction_session_id, auction_sessions(tournament_id)')
          .eq('id', invite_id)
          .single()

        if (!invite) return errorResponse('Invite not found', 404)
        if ((invite as any).invited_team_id !== callerTeamId) {
          return errorResponse('This invite is not for your team', 403)
        }
        if ((invite as any).status !== 'pending') {
          return errorResponse('Invite is no longer pending', 409)
        }

        await db.from('ownership_group_invites')
          .update({ status: 'declined', responded_at: new Date().toISOString(), updated_at: new Date().toISOString() })
          .eq('id', invite_id)

        const tournamentId = (invite as any).auction_sessions?.tournament_id
        if (tournamentId) {
          await broadcastToTournament(
            Deno.env.get('SUPABASE_URL')!,
            Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
            tournamentId,
            {
              event: 'group:invite_declined',
              payload: { invite_id, session_id: (invite as any).auction_session_id }
            }
          )
        }

        return jsonResponse({ success: true })
      }

      // ── Cancel a pending invite ──────────────────────────────
      case 'cancel': {
        const { invite_id } = body
        if (!invite_id) return errorResponse('invite_id is required', 400)

        const { data: invite } = await db
          .from('ownership_group_invites')
          .select('id, status, primary_ownership_id, auction_session_id, ownerships(owner_team_id), auction_sessions(tournament_id)')
          .eq('id', invite_id)
          .single()

        if (!invite) return errorResponse('Invite not found', 404)
        if ((invite as any).status !== 'pending') return errorResponse('Invite is no longer pending', 409)

        const ownerTeamId = (invite as any).ownerships?.owner_team_id
        if (ownerTeamId !== callerTeamId) {
          return errorResponse('Only the inviting team can cancel an invite', 403)
        }

        await db.from('ownership_group_invites')
          .update({ status: 'declined', responded_at: new Date().toISOString(), updated_at: new Date().toISOString() })
          .eq('id', invite_id)

        return jsonResponse({ success: true })
      }

      default:
        return errorResponse(`Unknown action: ${action}`, 400)
    }
  } catch (err) {
    console.error('manage-ownership-group error:', err)
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
