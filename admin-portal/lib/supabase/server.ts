// Server-side Supabase client.
// Reads the access token from our cc-session cookie and injects it
// as an Authorization header so auth.getUser() and RLS both work
// without relying on @supabase/ssr's session cookie management.

import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'

export function createClient() {
  const cookieStore = cookies()
  let accessToken: string | undefined

  try {
    const sessionCookie = cookieStore.get('cc-session')
    if (sessionCookie?.value) {
      const session = JSON.parse(sessionCookie.value)
      accessToken = session.access_token
    }
  } catch {
    // No session cookie — unauthenticated request
  }

  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!.trim(),
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!.trim(),
    {
      global: {
        headers: accessToken
          ? { Authorization: `Bearer ${accessToken}` }
          : {},
        // Bypass Next.js fetch() Data Cache for all Supabase queries
        fetch: (url: any, opts: any = {}) =>
          fetch(url, { ...opts, cache: 'no-store' as RequestCache }),
      },
      auth: {
        persistSession:     false,
        autoRefreshToken:   false,
        detectSessionInUrl: false,
      },
    }
  )
}

// Admin client using service role (bypasses RLS — use carefully)
export function createAdminClient() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!.trim(),
    process.env.SUPABASE_SERVICE_ROLE_KEY!.trim(),
    {
      auth: {
        persistSession:     false,
        autoRefreshToken:   false,
        detectSessionInUrl: false,
      },
      // CRITICAL: bypass Next.js fetch() Data Cache.
      // Next 14 caches all fetch() calls by default, including Supabase REST queries.
      // Without this, the very first query result gets cached and never refreshes.
      global: {
        fetch: (url: any, opts: any = {}) =>
          fetch(url, { ...opts, cache: 'no-store' as RequestCache }),
      },
    }
  )
}
