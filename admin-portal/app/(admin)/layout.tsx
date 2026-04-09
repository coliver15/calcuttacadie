import { redirect } from 'next/navigation'
import { headers } from 'next/headers'
import { createClient } from '@/lib/supabase/server'
import AdminNav from '@/components/layout/AdminNav'

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    const headersList = await headers()
    const pathname = headersList.get('x-invoke-path') || '/dashboard'
    redirect(`/auth/login?redirectTo=${encodeURIComponent(pathname)}`)
  }

  return (
    <div className="min-h-screen bg-[#020617]">
      <AdminNav userEmail={user.email} />
      <main className="lg:pl-56">
        <div className="min-h-screen">{children}</div>
      </main>
    </div>
  )
}
