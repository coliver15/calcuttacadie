import { type NextRequest } from 'next/server'
import { updateSession } from '@/lib/supabase/middleware'

// Middleware only refreshes the Supabase session token.
// Auth redirects are handled by server components (Node.js runtime)
// because Edge runtime has limitations reading Supabase cookies reliably.
export async function middleware(request: NextRequest) {
  return await updateSession(request)
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
