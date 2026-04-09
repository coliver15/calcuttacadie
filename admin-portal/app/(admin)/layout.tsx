import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import AdminNav from '@/components/layout/AdminNav'

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/auth/login')
  }

  return (
    <div className="min-h-screen bg-[#020617]">
      <AdminNav userEmail={user.email} />

      {/* Main content — offset for sidebar on desktop */}
      <main className="lg:pl-56">
        <div className="min-h-screen">{children}</div>
      </main>
    </div>
  )
}
