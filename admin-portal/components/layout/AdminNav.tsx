'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useState } from 'react'
import { cn } from '@/lib/utils'
import { createClient } from '@/lib/supabase/client'

interface NavItem {
  label: string
  href: string
  icon: React.ReactNode
}

const navItems: NavItem[] = [
  {
    label: 'Tournaments',
    href: '/dashboard',
    icon: (
      <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true">
        <rect x="2" y="2" width="5" height="5" rx="1" stroke="currentColor" strokeWidth="1.5" />
        <rect x="11" y="2" width="5" height="5" rx="1" stroke="currentColor" strokeWidth="1.5" />
        <rect x="2" y="11" width="5" height="5" rx="1" stroke="currentColor" strokeWidth="1.5" />
        <rect x="11" y="11" width="5" height="5" rx="1" stroke="currentColor" strokeWidth="1.5" />
      </svg>
    ),
  },
  {
    label: 'Billing',
    href: '/billing',
    icon: (
      <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true">
        <rect x="2" y="4" width="14" height="10" rx="2" stroke="currentColor" strokeWidth="1.5" />
        <path d="M2 7.5h14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        <path d="M5 11h3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      </svg>
    ),
  },
]

interface AdminNavProps {
  userEmail?: string
}

export default function AdminNav({ userEmail }: AdminNavProps) {
  const pathname = usePathname()
  const router = useRouter()
  const [signingOut, setSigningOut] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)

  async function handleSignOut() {
    setSigningOut(true)
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/auth/login')
    router.refresh()
  }

  return (
    <>
      {/* Desktop sidebar */}
      <aside className="hidden lg:flex lg:flex-col lg:w-56 lg:fixed lg:inset-y-0 bg-slate-900 border-r border-slate-800">
        {/* Logo */}
        <div className="flex items-center gap-3 px-5 py-5 border-b border-slate-800">
          <CalcuttaLogo />
          <div>
            <p className="text-sm font-bold text-white leading-none">Calcutta</p>
            <p className="text-xs text-slate-500 mt-0.5">Admin Portal</p>
          </div>
        </div>

        {/* Nav items */}
        <nav className="flex-1 px-3 py-4 space-y-1" aria-label="Main navigation">
          {navItems.map((item) => {
            const active =
              item.href === '/dashboard'
                ? pathname === '/dashboard' || pathname.startsWith('/tournaments')
                : pathname.startsWith(item.href)
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  'flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors',
                  active
                    ? 'bg-primary-900/40 text-primary-300 border border-primary-800/60'
                    : 'text-slate-400 hover:bg-slate-800 hover:text-slate-100'
                )}
              >
                {item.icon}
                {item.label}
              </Link>
            )
          })}
        </nav>

        {/* User area */}
        <div className="border-t border-slate-800 px-3 py-4">
          {userEmail && (
            <p className="text-xs text-slate-500 truncate px-3 mb-2">
              {userEmail}
            </p>
          )}
          <button
            onClick={handleSignOut}
            disabled={signingOut}
            className="flex w-full items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium text-slate-400 hover:bg-slate-800 hover:text-red-400 transition-colors disabled:opacity-50"
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
              <path d="M6 2H3a1 1 0 00-1 1v10a1 1 0 001 1h3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              <path d="M10.5 11l3-3-3-3M13.5 8h-7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            {signingOut ? 'Signing out…' : 'Sign Out'}
          </button>
        </div>
      </aside>

      {/* Mobile top bar */}
      <div className="lg:hidden sticky top-0 z-40 flex items-center justify-between px-4 py-3 bg-slate-900 border-b border-slate-800">
        <div className="flex items-center gap-2.5">
          <CalcuttaLogo size={28} />
          <span className="text-sm font-bold text-white">Calcutta Admin</span>
        </div>
        <button
          onClick={() => setMobileOpen((o) => !o)}
          className="p-2 rounded-lg text-slate-400 hover:bg-slate-800 hover:text-white transition-colors"
          aria-label="Open navigation"
        >
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
            <path d="M3 5h14M3 10h14M3 15h14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
        </button>
      </div>

      {/* Mobile drawer */}
      {mobileOpen && (
        <>
          <div
            className="lg:hidden fixed inset-0 z-40 bg-black/60"
            onClick={() => setMobileOpen(false)}
          />
          <div className="lg:hidden fixed inset-y-0 left-0 z-50 w-64 bg-slate-900 border-r border-slate-800 flex flex-col">
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800">
              <span className="text-sm font-bold text-white">Menu</span>
              <button
                onClick={() => setMobileOpen(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-800"
              >
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                  <path d="M2 2l12 12M14 2L2 14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                </svg>
              </button>
            </div>
            <nav className="flex-1 px-3 py-4 space-y-1">
              {navItems.map((item) => {
                const active = pathname.startsWith(item.href)
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setMobileOpen(false)}
                    className={cn(
                      'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors',
                      active
                        ? 'bg-primary-900/40 text-primary-300'
                        : 'text-slate-400 hover:bg-slate-800 hover:text-slate-100'
                    )}
                  >
                    {item.icon}
                    {item.label}
                  </Link>
                )
              })}
            </nav>
            <div className="border-t border-slate-800 px-3 py-4">
              {userEmail && (
                <p className="text-xs text-slate-500 truncate px-3 mb-2">{userEmail}</p>
              )}
              <button
                onClick={handleSignOut}
                className="flex w-full items-center gap-3 px-3 py-2 rounded-lg text-sm text-slate-400 hover:text-red-400 hover:bg-slate-800 transition-colors"
              >
                Sign Out
              </button>
            </div>
          </div>
        </>
      )}
    </>
  )
}

function CalcuttaLogo({ size = 32 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      aria-label="Calcutta logo"
    >
      {/* Golf flag / auction gavel hybrid mark */}
      <circle cx="16" cy="16" r="15" fill="#052e16" stroke="#16a34a" strokeWidth="1.5" />
      {/* Flag pole */}
      <path d="M10 24V9" stroke="#16a34a" strokeWidth="2" strokeLinecap="round" />
      {/* Flag */}
      <path d="M10 9l9 3-9 3z" fill="#16a34a" />
      {/* Gavel head */}
      <rect x="17" y="18" width="7" height="3" rx="1" fill="#4ade80" transform="rotate(-35 20 19)" />
      {/* Gavel handle */}
      <path d="M20 22l2.5 2.5" stroke="#4ade80" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  )
}
