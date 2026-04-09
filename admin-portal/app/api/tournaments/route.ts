// Server-side tournament creation — uses createClient() which injects
// the cc-session access token, so RLS correctly identifies the admin.

import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'

export async function POST(request: NextRequest) {
  // Verify the user is authenticated via our cc-session cookie
  const userClient = createClient()
  const { data: { user }, error: userError } = await userClient.auth.getUser()

  if (userError || !user) {
    // Fall back to reading directly from cc-session if getUser fails
    const { cookies } = await import('next/headers')
    const cookieStore = cookies()
    const session = cookieStore.get('cc-session')
    if (!session?.value) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const parsed = JSON.parse(session.value)
    if (!parsed?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
  }

  // Use service role client for all DB operations — bypasses RLS safely
  // (we've already verified the user above)
  const db = createAdminClient()

  // Re-fetch user ID reliably from cc-session
  const { cookies } = await import('next/headers')
  const cookieStore = cookies()
  const sessionCookie = cookieStore.get('cc-session')
  if (!sessionCookie?.value) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const session = JSON.parse(sessionCookie.value)
  const accessToken = session.access_token

  // Get user ID from Supabase using the access token directly
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!.trim()
  const anonKey    = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!.trim()
  const userRes    = await fetch(`${supabaseUrl}/auth/v1/user`, {
    headers: { Authorization: `Bearer ${accessToken}`, apikey: anonKey },
    cache: 'no-store',
  })
  if (!userRes.ok) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const userInfo = await userRes.json()
  const userId   = userInfo.id

  // Check available credits
  const { data: purchases } = await db
    .from('tournament_purchases')
    .select('id, tournaments_remaining')
    .eq('admin_id', userId)
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
  const { data: tournament, error: tournamentError } = await db
    .from('tournaments')
    .insert({
      created_by: userId,
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
  await db
    .from('tournament_purchases')
    .update({ tournaments_remaining: purchase.tournaments_remaining - 1 })
    .eq('id', purchase.id)

  // Add as tournament owner
  await db
    .from('tournament_admins')
    .insert({ tournament_id: tournament.id, admin_id: userId, role: 'owner' })

  return NextResponse.json({ id: tournament.id })
}
