// Server-side tournament creation — uses createClient() which injects
// the cc-session access token, so RLS correctly identifies the admin.

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { cookies } from 'next/headers'

export async function POST(request: NextRequest) {
  const supabase = createClient()

  // Get authenticated user
  const { data: { user }, error: userError } = await supabase.auth.getUser()
  if (userError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Check available credits
  const { data: purchases } = await supabase
    .from('tournament_purchases')
    .select('id, tournaments_remaining')
    .eq('admin_id', user.id)
    .eq('status', 'paid')
    .gt('tournaments_remaining', 0)
    .order('created_at', { ascending: true })
    .limit(1)

  if (!purchases || purchases.length === 0) {
    return NextResponse.json(
      { error: 'No tournament credits available. Please purchase credits.' },
      { status: 402 }
    )
  }

  const purchase = purchases[0]
  const body = await request.json()

  // Create the tournament
  const { data: tournament, error: tournamentError } = await supabase
    .from('tournaments')
    .insert({
      created_by: user.id,
      name: body.name,
      club_name: body.club_name,
      club_location: body.club_location || null,
      tournament_date: body.tournament_date,
      status: 'setup',
      timer_duration_seconds: body.timer_duration_seconds,
      timer_extension_seconds: body.timer_extension_seconds,
      timer_extension_threshold_seconds: body.timer_extension_threshold_seconds,
      min_bid_increment_cents: body.min_bid_increment_cents,
      auction_order_type: body.auction_order_type,
    })
    .select('id')
    .single()

  if (tournamentError) {
    return NextResponse.json({ error: tournamentError.message }, { status: 500 })
  }

  // Decrement the credit
  await supabase
    .from('tournament_purchases')
    .update({ tournaments_remaining: purchase.tournaments_remaining - 1 })
    .eq('id', purchase.id)

  // Add as tournament owner
  await supabase
    .from('tournament_admins')
    .insert({ tournament_id: tournament.id, admin_id: user.id, role: 'owner' })

  return NextResponse.json({ id: tournament.id })
}
