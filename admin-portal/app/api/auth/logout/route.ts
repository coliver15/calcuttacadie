import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { clearSessionCookies } from '@/lib/auth'

export async function POST(request: NextRequest) {
  const cookieStore = cookies()
  clearSessionCookies(cookieStore)

  const response = NextResponse.redirect(new URL('/auth/login', request.url), { status: 303 })
  // Also clear on the redirect response itself so browser drops them immediately
  const gone = { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax' as const, path: '/', maxAge: 0 }
  response.cookies.set('cc-session', '', gone)
  response.cookies.set('sb-oxjydvtghyazocuocvia-auth-token', '', { ...gone, httpOnly: false })
  return response
}
