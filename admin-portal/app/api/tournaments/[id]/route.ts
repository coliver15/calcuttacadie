import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { getAuthUser } from '@/lib/auth'

async function verifyAdmin(db: any, tournamentId: string, userId: string) {
  const { data } = await db.from('tournament_admins').select('role')
    .eq('tournament_id', tournamentId).eq('admin_id', userId).single()
  return data
}

export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  const user = await getAuthUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const db = createAdminClient()
  if (!(await verifyAdmin(db, params.id, user.id)))
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  const body = await request.json()
  const { data, error } = await db.from('tournaments')
    .update(body).eq('id', params.id).select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
  const user = await getAuthUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const db = createAdminClient()
  const admin = await verifyAdmin(db, params.id, user.id)
  if (!admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  if (admin.role !== 'owner') return NextResponse.json({ error: 'Only the owner can delete' }, { status: 403 })
  const { error } = await db.from('tournaments').delete().eq('id', params.id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
