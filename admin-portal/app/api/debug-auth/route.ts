import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'

export async function GET() {
  const cookieStore = cookies()
  const all = cookieStore.getAll()
  const session = cookieStore.get('cc-session')

  let parsed: any = null
  let fetchResult: any = null

  if (session?.value) {
    try {
      parsed = JSON.parse(session.value)
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!.trim()
      const anonKey     = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!.trim()
      const res = await fetch(`${supabaseUrl}/auth/v1/user`, {
        headers: { 'Authorization': `Bearer ${parsed.access_token}`, 'apikey': anonKey },
        cache: 'no-store',
      })
      fetchResult = { status: res.status, ok: res.ok, body: await res.json() }
    } catch (e: any) {
      fetchResult = { error: e.message }
    }
  }

  return NextResponse.json({
    env: {
      supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL,
      hasAnonKey: !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    },
    totalCookies: all.length,
    cookieNames: all.map(c => c.name),
    hasSession: !!session,
    sessionEmail: parsed?.email ?? null,
    fetchResult,
  })
}
