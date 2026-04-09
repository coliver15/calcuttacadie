import { redirect } from 'next/navigation'
import { cookies } from 'next/headers'
import AdminNav from '@/components/layout/AdminNav'

// Auth check that bypasses @supabase/ssr entirely.
// Reads the session cookie directly and validates the access token
// with a raw fetch to the Supabase auth API.
async function getAuthUser(): Promise<{ id: string; email: string } | null> {
  try {
    const cookieStore = cookies()
    const projectRef = 'oxjydvtghyazocuocvia'
    const cookieName = `sb-${projectRef}-auth-token`

    const sessionCookie = cookieStore.get(cookieName)
    if (!sessionCookie?.value) return null

    // Parse the session JSON stored by @supabase/ssr
    let session: any
    try {
      session = JSON.parse(sessionCookie.value)
    } catch {
      return null
    }

    const accessToken = session?.access_token
    if (!accessToken) return null

    // Validate the access token directly with Supabase auth API
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!.trim()
    const anonKey    = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!.trim()

    const res = await fetch(`${supabaseUrl}/auth/v1/user`, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'apikey': anonKey,
      },
      cache: 'no-store',
    })

    if (!res.ok) return null

    const user = await res.json()
    if (!user?.id) return null

    return { id: user.id, email: user.email }
  } catch {
    return null
  }
}

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const user = await getAuthUser()

  if (!user) {
    redirect('/auth/login?redirectTo=/dashboard')
  }

  return (
    <div className="min-h-screen bg-[#020617]">
      <AdminNav userEmail={user!.email} />
      <main className="lg:pl-56">
        <div className="min-h-screen">{children}</div>
      </main>
    </div>
  )
}
