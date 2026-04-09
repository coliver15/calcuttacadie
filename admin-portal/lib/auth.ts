// Shared auth helper for all server-side API routes and server components.
// Reads from cc-session cookie, validates with Supabase, handles token refresh.

import { cookies } from 'next/headers'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!.trim()
const ANON_KEY     = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!.trim()
const PROJECT_REF  = 'oxjydvtghyazocuocvia'
const IS_PROD      = process.env.NODE_ENV === 'production'

export interface AuthUser {
  id: string
  email: string
  accessToken: string
}

/** Read and validate the current session. Refreshes token if expiring soon. */
export async function getAuthUser(): Promise<AuthUser | null> {
  const cookieStore = cookies()
  const raw = cookieStore.get('cc-session')?.value
  if (!raw) return null

  let session: Record<string, any>
  try { session = JSON.parse(raw) } catch { return null }

  const { access_token, refresh_token, expires_at } = session
  if (!access_token) return null

  // Refresh if token expires in < 5 minutes
  const now = Math.floor(Date.now() / 1000)
  if (expires_at && expires_at - now < 300 && refresh_token) {
    const refreshed = await attemptRefresh(refresh_token)
    if (refreshed) {
      setSessionCookies(cookieStore, refreshed)
      return { id: refreshed.user.id, email: refreshed.user.email, accessToken: refreshed.access_token }
    }
  }

  // Validate existing token
  try {
    const res = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
      headers: { Authorization: `Bearer ${access_token}`, apikey: ANON_KEY },
      cache: 'no-store',
    })
    if (!res.ok) return null
    const user = await res.json()
    return user?.id ? { id: user.id, email: user.email, accessToken: access_token } : null
  } catch { return null }
}

/** Attempt to refresh an expired session. Returns null if refresh fails. */
async function attemptRefresh(refreshToken: string) {
  try {
    const res = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=refresh_token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', apikey: ANON_KEY },
      body: JSON.stringify({ refresh_token: refreshToken }),
      cache: 'no-store',
    })
    if (!res.ok) return null
    return res.json()
  } catch { return null }
}

/** Write both session cookies from a Supabase token response. */
export function setSessionCookies(cookieStore: ReturnType<typeof cookies>, data: any) {
  const expiresIn = data.expires_in ?? 3600
  const expiresAt = Math.floor(Date.now() / 1000) + expiresIn
  const base = { httpOnly: true, secure: IS_PROD, sameSite: 'lax' as const, path: '/', maxAge: expiresIn }

  try {
    cookieStore.set('cc-session', JSON.stringify({
      access_token:  data.access_token,
      refresh_token: data.refresh_token,
      email:         data.user?.email ?? '',
      expires_at:    expiresAt,
    }), base)

    cookieStore.set(`sb-${PROJECT_REF}-auth-token`, JSON.stringify({
      access_token:  data.access_token,
      refresh_token: data.refresh_token,
      token_type:    'bearer',
      expires_in:    expiresIn,
      expires_at:    expiresAt,
      user:          data.user,
    }), { ...base, httpOnly: false })
  } catch {
    // Silently ignore — can't set cookies from Server Component context
  }
}

/** Clear all session cookies (for sign-out). */
export function clearSessionCookies(cookieStore: ReturnType<typeof cookies>) {
  const gone = { httpOnly: true, secure: IS_PROD, sameSite: 'lax' as const, path: '/', maxAge: 0 }
  try {
    cookieStore.set('cc-session', '', gone)
    cookieStore.set(`sb-${PROJECT_REF}-auth-token`, '', { ...gone, httpOnly: false })
  } catch { /* ignore */ }
}
