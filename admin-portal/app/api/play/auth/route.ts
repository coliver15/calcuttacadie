import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import {
  PLAYER_COOKIE_NAME,
  PLAYER_COOKIE_MAX_AGE_SECONDS,
  buildSession,
  signPayload,
} from '@/lib/playerAuth'

export async function POST(req: NextRequest) {
  let body: { code?: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'INVALID_BODY' }, { status: 400 })
  }

  const codeRaw = (body.code ?? '').trim()
  if (codeRaw.length !== 6) {
    return NextResponse.json({ error: 'INVALID_CODE' }, { status: 400 })
  }
  const code = codeRaw.toUpperCase()

  const db = createAdminClient()
  const { data: team, error } = await db
    .from('teams')
    .select('id, tournament_id, access_code')
    .ilike('access_code', code)
    .maybeSingle()

  if (error || !team) {
    return NextResponse.json({ error: 'INVALID_CODE' }, { status: 404 })
  }

  const { data: tournament } = await db
    .from('tournaments')
    .select('id, status')
    .eq('id', team.tournament_id)
    .single()

  if (!tournament) {
    return NextResponse.json({ error: 'INVALID_CODE' }, { status: 404 })
  }

  if (tournament.status === 'complete') {
    return NextResponse.json({ error: 'TOURNAMENT_COMPLETE' }, { status: 410 })
  }

  const session = buildSession(team.id, team.tournament_id)
  const token = signPayload(session)

  const res = NextResponse.json({ tournament_id: team.tournament_id })
  res.cookies.set(PLAYER_COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: PLAYER_COOKIE_MAX_AGE_SECONDS,
  })
  return res
}

export async function DELETE() {
  const res = NextResponse.json({ ok: true })
  res.cookies.set(PLAYER_COOKIE_NAME, '', {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 0,
  })
  return res
}
