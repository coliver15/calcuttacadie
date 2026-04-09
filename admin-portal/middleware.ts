import { NextResponse, type NextRequest } from 'next/server'

// Auth is handled by the admin layout (reads cc-session cookie + validates
// with raw fetch). The middleware no longer needs to manage sessions —
// @supabase/ssr's updateSession() was clearing cookies on every request
// because it couldn't parse our session, causing logout on form submits.
export function middleware(request: NextRequest) {
  return NextResponse.next()
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
