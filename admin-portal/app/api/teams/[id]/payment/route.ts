import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { getAuthUser } from '@/lib/auth'

export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  const user = await getAuthUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const db = createAdminClient()
  const { ownershipId, confirmed, tournamentId } = await request.json()

  const { data: admin } = await db.from('tournament_admins').select('role')
    .eq('tournament_id', tournamentId).eq('admin_id', user.id).single()
  if (!admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { error } = await db.from('ownerships').update({
    payment_confirmed: confirmed,
    payment_confirmed_at: confirmed ? new Date().toISOString() : null,
  }).eq('id', ownershipId)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
