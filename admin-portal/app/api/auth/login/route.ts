// Completely bypasses @supabase/ssr.
// Calls Supabase auth REST API directly, sets a simple session cookie manually.

import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  const contentType = request.headers.get('content-type') ?? ''
  let email = '', password = '', redirectTo = '/dashboard'

  if (contentType.includes('application/json')) {
    const b = await request.json()
    email = b.email ?? ''; password = b.password ?? ''; redirectTo = b.redirectTo ?? '/dashboard'
  } else {
    const f = await request.formData()
    email = (f.get('email') as string) ?? ''
    password = (f.get('password') as string) ?? ''
    redirectTo = (f.get('redirectTo') as string) ?? '/dashboard'
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!.trim()
  const anonKey    = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!.trim()

  const loginUrl = new URL('/auth/login', request.url)
  loginUrl.searchParams.set('redirectTo', redirectTo)

  // Call Supabase password auth endpoint directly
  const authRes = await fetch(`${supabaseUrl}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'apikey': anonKey,
    },
    body: JSON.stringify({ email, password }),
    cache: 'no-store',
  })

  if (!authRes.ok) {
    loginUrl.searchParams.set('error', 'Invalid email or password')
    return NextResponse.redirect(loginUrl, { status: 303 })
  }

  const data = await authRes.json()
  const accessToken  = data.access_token
  const refreshToken = data.refresh_token
  const expiresIn    = data.expires_in ?? 3600
  const userEmail    = data.user?.email ?? email

  if (!accessToken) {
    loginUrl.searchParams.set('error', 'Login failed — no token returned')
    return NextResponse.redirect(loginUrl, { status: 303 })
  }

  // Build redirect response
  const successUrl = new URL(redirectTo, request.url)
  const response   = NextResponse.redirect(successUrl, { status: 303 })

  // Set a simple session cookie — no library magic
  response.cookies.set('cc-session', JSON.stringify({
    access_token:  accessToken,
    refresh_token: refreshToken,
    email:         userEmail,
  }), {
    httpOnly: true,
    secure:   process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path:     '/',
    maxAge:   expiresIn,
  })

  return response
}
