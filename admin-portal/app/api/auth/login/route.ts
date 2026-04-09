// Server-side login route handler
// Accepts both form submissions (application/x-www-form-urlencoded)
// and JSON bodies (application/json).
//
// On success: 303 redirect to dashboard with Set-Cookie headers
// On failure: 303 redirect back to login with ?error= param
//
// Using NextResponse.redirect() (true HTTP 303) rather than
// Next.js redirect() ensures Set-Cookie headers are in the same
// HTTP response the browser follows — no cookie propagation issues.

import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  const contentType = request.headers.get('content-type') ?? ''

  let email = '', password = '', redirectTo = '/dashboard'

  if (contentType.includes('application/json')) {
    const body = await request.json()
    email      = body.email      ?? ''
    password   = body.password   ?? ''
    redirectTo = body.redirectTo ?? '/dashboard'
  } else {
    // Standard HTML form POST (application/x-www-form-urlencoded)
    const form = await request.formData()
    email      = (form.get('email')      as string) ?? ''
    password   = (form.get('password')   as string) ?? ''
    redirectTo = (form.get('redirectTo') as string) ?? '/dashboard'
  }

  const loginUrl    = new URL('/auth/login', request.url)
  const successUrl  = new URL(redirectTo,    request.url)

  // Build the success redirect first so we can attach cookies to it
  const response = NextResponse.redirect(successUrl, { status: 303 })

  const cookieStore = cookies()

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!.trim(),
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!.trim(),
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        // Write session cookies directly onto the redirect response.
        // When the browser follows the 303 it receives these Set-Cookie
        // headers and stores them before the GET /dashboard request fires.
        setAll(cookiesToSet: { name: string; value: string; options: Record<string, unknown> }[]) {
          cookiesToSet.forEach(({ name, value, options }) => {
            response.cookies.set(
              name,
              value,
              options as Parameters<typeof response.cookies.set>[2]
            )
          })
        },
      },
    }
  )

  const { error } = await supabase.auth.signInWithPassword({ email, password })

  if (error) {
    loginUrl.searchParams.set('error', error.message)
    loginUrl.searchParams.set('redirectTo', redirectTo)
    return NextResponse.redirect(loginUrl, { status: 303 })
  }

  return response
}
