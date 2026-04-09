// Temporary debug endpoint — remove before launch
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'

export async function GET() {
  const cookieStore = cookies()
  const allCookies = cookieStore.getAll()

  const supabaseCookies = allCookies.filter(c =>
    c.name.includes('sb-') || c.name.includes('supabase')
  )

  // Try getUser()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: () => {},
      },
    }
  )

  const { data: sessionData } = await supabase.auth.getSession()
  const { data: { user }, error: userError } = await supabase.auth.getUser()

  return NextResponse.json({
    env: {
      supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL ?? 'MISSING',
      hasAnonKey: !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    },
    totalCookies: allCookies.length,
    supabaseCookies: supabaseCookies.map(c => ({
      name: c.name,
      valueLength: c.value.length,
      valueStart: c.value.substring(0, 60),
      isJson: c.value.startsWith('{'),
      isBase64: c.value.startsWith('base64-'),
    })),
    getSession: {
      hasSession: !!sessionData?.session,
      error: null,
    },
    getUser: {
      userFound: !!user,
      email: user?.email ?? null,
      error: userError?.message ?? null,
    },
  })
}
