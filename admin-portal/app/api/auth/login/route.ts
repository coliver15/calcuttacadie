// Server-side login route
// Signs in via createServerClient so the session cookie is written
// directly to the HTTP response — same format the server can read.
// This bypasses the browser client encoding mismatch.

import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  const { email, password, redirectTo = '/dashboard' } = await request.json()

  if (!email || !password) {
    return NextResponse.json({ error: 'Email and password are required' }, { status: 400 })
  }

  const cookieStore = await cookies()

  // Build the redirect response first so we can attach cookies to it
  const redirectUrl = new URL(redirectTo, request.url)
  const response = NextResponse.redirect(redirectUrl, { status: 303 })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        // Write cookies directly onto the redirect response
        // so the browser receives Set-Cookie headers
        setAll(cookiesToSet: { name: string; value: string; options: Record<string, unknown> }[]) {
          cookiesToSet.forEach(({ name, value, options }) => {
            response.cookies.set(name, value, options as Parameters<typeof response.cookies.set>[2])
          })
        },
      },
    }
  )

  const { error } = await supabase.auth.signInWithPassword({ email, password })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 401 })
  }

  // Session cookies are now on the response — redirect to dashboard
  return response
}
