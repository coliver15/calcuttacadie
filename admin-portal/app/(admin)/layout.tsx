import { redirect } from 'next/navigation'
import { cookies } from 'next/headers'
import AdminNav from '@/components/layout/AdminNav'

async function getAuthUser() {
  try {
    const cookieStore = cookies()
    const sessionCookie = cookieStore.get('cc-session')
    if (!sessionCookie?.value) return null

    const session = JSON.parse(sessionCookie.value)
    const accessToken = session?.access_token
    if (!accessToken) return null

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!.trim()
    const anonKey     = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!.trim()

    const res = await fetch(`${supabaseUrl}/auth/v1/user`, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'apikey': anonKey,
      },
      cache: 'no-store',
    })

    if (!res.ok) return null
    const user = await res.json()
    return user?.id ? { id: user.id, email: user.email } : null
  } catch {
    return null
  }
}

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
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
