import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { getAuthUser } from '@/lib/auth'

async function verifyFlightAccess(db: any, flightId: string, userId: string) {
  const { data: flight } = await db.from('flights').select('tournament_id').eq('id', flightId).single()
  if (!flight) return false
  const { data } = await db.from('tournament_admins').select('role')
    .eq('tournament_id', flight.tournament_id).eq('admin_id', userId).single()
  return !!data
}

export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  const user = await getAuthUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const db = createAdminClient()
  if (!(await verifyFlightAccess(db, params.id, user.id)))
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  const body = await request.json()
  // Update flight name/order
  if (body.name !== undefined || body.display_order !== undefined) {
    await db.from('flights').update({
      ...(body.name !== undefined && { name: body.name }),
      ...(body.display_order !== undefined && { display_order: body.display_order }),
    }).eq('id', params.id)
  }
  // Replace payout tiers if provided
  if (body.payoutTiers) {
    await db.from('flight_payout_tiers').delete().eq('flight_id', params.id)
    if (body.payoutTiers.length) {
      await db.from('flight_payout_tiers').insert(
        body.payoutTiers.map((t: any) => ({ flight_id: params.id, place: t.place, percentage: t.percentage }))
      )
    }
  }
  const { data } = await db.from('flights').select('*, flight_payout_tiers(*)').eq('id', params.id).single()
  return NextResponse.json(data)
}

export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
  const user = await getAuthUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const db = createAdminClient()
  if (!(await verifyFlightAccess(db, params.id, user.id)))
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  await db.from('flight_payout_tiers').delete().eq('flight_id', params.id)
  const { error } = await db.from('flights').delete().eq('id', params.id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
