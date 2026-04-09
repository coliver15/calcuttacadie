import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { setSessionCookies } from '@/lib/auth'

export async function POST(request: NextRequest) {
  const contentType = request.headers.get('content-type') ?? ''
  let email = '', password = '', redirectTo = '/dashboard'

  if (contentType.includes('application/json')) {
    const b = await request.json()
    email = b.email ?? ''; password = b.password ?? ''; redirectTo = b.redirectTo ?? '/dashboard'
  } else {
    const f = await request.formData()
    email      = (f.get('email')      as string) ?? ''
    password   = (f.get('password')   as string) ?? ''
    redirectTo = (f.get('redirectTo') as string) ?? '/dashboard'
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!.trim()
  const anonKey    = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!.trim()
  const loginUrl   = new URL('/auth/login', request.url)
  loginUrl.searchParams.set('redirectTo', redirectTo)

  const authRes = await fetch(`${supabaseUrl}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'apikey': anonKey },
    body: JSON.stringify({ email, password }),
    cache: 'no-store',
  })

  if (!authRes.ok) {
    loginUrl.searchParams.set('error', 'Invalid email or password')
    return NextResponse.redirect(loginUrl, { status: 303 })
  }

  const data = await authRes.json()
  if (!data.access_token) {
    loginUrl.searchParams.set('error', 'Login failed — no token returned')
    return NextResponse.redirect(loginUrl, { status: 303 })
  }

  const successUrl = new URL(redirectTo, request.url)
  const response   = NextResponse.redirect(successUrl, { status: 303 })

  // Set both session cookies on the redirect response
  const expiresIn = data.expires_in ?? 3600
  const expiresAt = Math.floor(Date.now() / 1000) + expiresIn
  const base      = { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax' as const, path: '/', maxAge: expiresIn }
  const projectRef = 'oxjydvtghyazocuocvia'

  response.cookies.set('cc-session', JSON.stringify({
    access_token:  data.access_token,
    refresh_token: data.refresh_token,
    email:         data.user?.email ?? email,
    expires_at:    expiresAt,
  }), base)

  response.cookies.set(`sb-${projectRef}-auth-token`, JSON.stringify({
    access_token:  data.access_token,
    refresh_token: data.refresh_token,
    token_type:    'bearer',
    expires_in:    expiresIn,
    expires_at:    expiresAt,
    user:          data.user,
  }), { ...base, httpOnly: false })

  return response
}
