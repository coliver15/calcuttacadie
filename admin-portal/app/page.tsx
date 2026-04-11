import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'

export default async function LandingPage() {
  // Redirect authenticated users to dashboard
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (user) {
    redirect('/dashboard')
  }

  return (
    <div className="min-h-screen bg-[#020617] text-white">
      {/* Header */}
      <header className="border-b border-slate-800 bg-slate-900/80 backdrop-blur-sm sticky top-0 z-20">
        <div className="mx-auto max-w-6xl px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            {/* Logo mark */}
            <svg width="32" height="32" viewBox="0 0 32 32" fill="none" aria-label="Calcutta">
              <circle cx="16" cy="16" r="15" fill="#052e16" stroke="#16a34a" strokeWidth="1.5" />
              <path d="M10 24V9" stroke="#16a34a" strokeWidth="2" strokeLinecap="round" />
              <path d="M10 9l9 3-9 3z" fill="#16a34a" />
              <rect x="17" y="18" width="7" height="3" rx="1" fill="#4ade80" transform="rotate(-35 20 19)" />
              <path d="M20 22l2.5 2.5" stroke="#4ade80" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
            <span className="text-lg font-bold tracking-tight">Calcutta</span>
          </div>
          <div className="flex items-center gap-3">
            <Link
              href="/auth/login"
              className="text-sm text-slate-400 hover:text-white transition-colors"
            >
              Sign In
            </Link>
            <Link
              href="/auth/signup"
              className="rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700 transition-colors"
            >
              Get Started
            </Link>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="relative overflow-hidden">
        {/* Background glow */}
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-[-20%] left-1/2 -translate-x-1/2 w-[800px] h-[600px] bg-primary-600/10 rounded-full blur-3xl" />
        </div>

        <div className="relative mx-auto max-w-5xl px-6 py-24 sm:py-32 text-center">
          <div className="inline-flex items-center gap-2 rounded-full border border-primary-700/50 bg-primary-900/30 px-4 py-1.5 text-sm text-primary-300 mb-8">
            <span className="h-1.5 w-1.5 rounded-full bg-primary-400 animate-pulse" />
            Built for golf tournament administrators
          </div>

          <h1 className="text-5xl sm:text-6xl lg:text-7xl font-bold tracking-tight leading-none mb-6">
            Run your Calcutta
            <span className="block text-primary-400 mt-1">the right way.</span>
          </h1>

          <p className="text-xl text-slate-400 max-w-2xl mx-auto mb-10 leading-relaxed">
            A purpose-built platform for running live Calcutta auctions at golf tournaments.
            Real-time bidding, automatic payouts, and a TV-ready display mode.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link
              href="/auth/signup"
              className="w-full sm:w-auto rounded-xl bg-primary-600 px-8 py-4 text-base font-semibold text-white hover:bg-primary-700 transition-colors shadow-lg shadow-primary-900/40"
            >
              Create an Account →
            </Link>
            <Link
              href="#pricing"
              className="w-full sm:w-auto rounded-xl border border-slate-700 px-8 py-4 text-base font-semibold text-slate-300 hover:bg-slate-800 hover:text-white transition-colors"
            >
              View Pricing
            </Link>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="mx-auto max-w-6xl px-6 py-16 sm:py-20">
        <h2 className="text-center text-3xl font-bold text-white mb-4">
          Everything you need to run the auction
        </h2>
        <p className="text-center text-slate-400 mb-12 max-w-xl mx-auto">
          From team setup to final payouts — one platform handles it all.
        </p>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {features.map((feature) => (
            <div
              key={feature.title}
              className="rounded-xl border border-slate-700/60 bg-slate-900 p-6"
            >
              <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-lg bg-primary-900/60 text-primary-400">
                {feature.icon}
              </div>
              <h3 className="text-base font-semibold text-white mb-2">
                {feature.title}
              </h3>
              <p className="text-sm text-slate-400 leading-relaxed">
                {feature.description}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* Pricing */}
      <section
        id="pricing"
        className="mx-auto max-w-4xl px-6 py-16 sm:py-20"
      >
        <h2 className="text-center text-3xl font-bold text-white mb-4">
          Simple pricing
        </h2>
        <p className="text-center text-slate-400 mb-12">
          Pay once per tournament. No subscriptions.
        </p>
        <div className="grid sm:grid-cols-2 gap-6">
          {/* Single */}
          <div className="rounded-2xl border border-slate-700 bg-slate-900 p-8">
            <p className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-3">
              Single Tournament
            </p>
            <p className="text-5xl font-bold text-white mb-2">
              $300
            </p>
            <p className="text-slate-400 text-sm mb-6">One-time access</p>
            <ul className="space-y-2 text-sm text-slate-300 mb-8">
              <li className="flex items-center gap-2">
                <span className="text-primary-400">✓</span> Full auction control panel
              </li>
              <li className="flex items-center gap-2">
                <span className="text-primary-400">✓</span> Live bidding with timer
              </li>
              <li className="flex items-center gap-2">
                <span className="text-primary-400">✓</span> TV display mode
              </li>
              <li className="flex items-center gap-2">
                <span className="text-primary-400">✓</span> Up to 3 co-admins
              </li>
            </ul>
            <Link
              href="/auth/signup"
              className="block w-full text-center rounded-lg border border-slate-600 px-4 py-3 text-sm font-semibold text-slate-200 hover:bg-slate-800 transition-colors"
            >
              Get Started
            </Link>
          </div>

          {/* 5-pack */}
          <div className="relative rounded-2xl border border-primary-700/60 bg-primary-950/30 p-8">
            <div className="absolute -top-3 left-6">
              <span className="rounded-full bg-primary-600 px-3 py-1 text-xs font-bold text-white">
                BEST VALUE
              </span>
            </div>
            <p className="text-sm font-semibold text-primary-400 uppercase tracking-wider mb-3">
              5-Tournament Pack
            </p>
            <p className="text-5xl font-bold text-white mb-2">
              $1,000
            </p>
            <p className="text-slate-400 text-sm mb-1">$200/tournament</p>
            <p className="text-primary-400 text-xs font-medium mb-6">Save $500</p>
            <ul className="space-y-2 text-sm text-slate-300 mb-8">
              <li className="flex items-center gap-2">
                <span className="text-primary-400">✓</span> Everything in Single
              </li>
              <li className="flex items-center gap-2">
                <span className="text-primary-400">✓</span> 5 tournament credits
              </li>
              <li className="flex items-center gap-2">
                <span className="text-primary-400">✓</span> Credits never expire
              </li>
              <li className="flex items-center gap-2">
                <span className="text-primary-400">✓</span> Priority support
              </li>
            </ul>
            <Link
              href="/auth/signup"
              className="block w-full text-center rounded-lg bg-primary-600 px-4 py-3 text-sm font-semibold text-white hover:bg-primary-700 transition-colors"
            >
              Get the Pack
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-slate-800 py-8 text-center text-sm text-slate-600">
        © {new Date().getFullYear()} Calcutta Golf. All rights reserved.
      </footer>
    </div>
  )
}

const features = [
  {
    title: 'Live Auction Engine',
    description:
      'Real-time bidding with an auto-extending countdown timer. Bids under the threshold automatically extend the clock.',
    icon: (
      <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
        <circle cx="10" cy="10" r="8" stroke="currentColor" strokeWidth="1.5" />
        <path d="M10 6v4l3 2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    title: 'Flight Management',
    description:
      'Organize teams into flights with custom payout tiers. Configure percentages per placement that sum to 100%.',
    icon: (
      <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
        <path d="M3 16l4-8 3 4 3-6 4 10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
  },
  {
    title: 'TV Display Mode',
    description:
      'Full-screen read-only display perfect for projectors. Shows current team, bid, and live feed in real time.',
    icon: (
      <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
        <rect x="2" y="3" width="16" height="11" rx="2" stroke="currentColor" strokeWidth="1.5" />
        <path d="M7 17h6M10 14v3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    title: 'Ownership Tracking',
    description:
      'Track partial ownership of teams, mark payments received, and display confirmed ownership percentages.',
    icon: (
      <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
        <path d="M10 2l2 6h6l-5 3.5L15 18l-5-3.5L5 18l2-6.5L2 8h6z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
  },
  {
    title: 'Co-Admin Access',
    description:
      'Invite up to 3 co-administrators to help manage tournament setup and operations.',
    icon: (
      <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
        <circle cx="7" cy="7" r="3" stroke="currentColor" strokeWidth="1.5" />
        <circle cx="14" cy="7" r="3" stroke="currentColor" strokeWidth="1.5" />
        <path d="M2 17c0-3 2-4.5 5-4.5s5 1.5 5 4.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        <path d="M14 12.5c2 0 4 1 4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    title: 'Results & Payouts',
    description:
      'Enter final placements and automatically calculate winnings per ownership share based on configured payout tiers.',
    icon: (
      <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
        <path d="M7 3H5a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V5a2 2 0 00-2-2h-2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        <rect x="7" y="2" width="6" height="3" rx="1" stroke="currentColor" strokeWidth="1.5" />
        <path d="M7 10l2 2 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
  },
]
