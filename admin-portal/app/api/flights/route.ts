import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { getAuthUser } from '@/lib/auth'

export async function POST(request: NextRequest) {
  const user = await getAuthUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const db = createAdminClient()
  const body = await request.json()
  const { tournamentId, name, displayOrder, payoutTiers } = body
  const { data: admin } = await db.from('tournament_admins').select('role')
    .eq('tournament_id', tournamentId).eq('admin_id', user.id).single()
  if (!admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  const { data: flight, error } = await db.from('flights')
    .insert({ tournament_id: tournamentId, name, display_order: displayOrder ?? 0 })
    .select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (payoutTiers?.length) {
    await db.from('flight_payout_tiers').insert(
      payoutTiers.map((t: any) => ({ flight_id: flight.id, place: t.place, percentage: t.percentage }))
    )
  }
  return NextResponse.json(flight)
}
