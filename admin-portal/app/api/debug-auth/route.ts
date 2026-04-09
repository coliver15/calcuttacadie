// Temporary debug endpoint — remove before launch
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET() {
  const cookieStore = await cookies()
  const allCookies = cookieStore.getAll()

  const supabaseCookies = allCookies.filter(c =>
    c.name.includes('sb-') || c.name.includes('supabase')
  )

  const supabase = createClient()
  const { data: { user }, error } = await supabase.auth.getUser()

  return NextResponse.json({
    totalCookies: allCookies.length,
    supabaseCookieCount: supabaseCookies.length,
    supabaseCookieNames: supabaseCookies.map(c => c.name),
    userFound: !!user,
    userEmail: user?.email ?? null,
    getUser_error: error?.message ?? null,
  })
}
