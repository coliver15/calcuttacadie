'use client'

import { useRouter } from 'next/navigation'
import { formatCents } from '@/lib/utils'
import type { Tournament, Team } from '@/types/database'
import PlayerTabBar from '@/components/play/PlayerTabBar'
import PlayerHeader from '@/components/play/PlayerHeader'

export interface PortfolioEntry {
  id: string
  team_name: string
  flight_name: string | null
  ownership_percentage: number
  paid_cents: number
  projected_cents: number
  ownership_type: 'purchase' | 'buyback' | 'group_share'
  payment_confirmed: boolean
}

interface Props {
  tournament: Tournament
  me: Team
  entries: PortfolioEntry[]
}

export default function PlayerPortfolioClient({ tournament, me, entries }: Props) {
  const router = useRouter()
  const total = entries.reduce((s, e) => s + e.paid_cents, 0)

  async function signOut() {
    await fetch('/api/play/auth', { method: 'DELETE' })
    router.push('/play')
    router.refresh()
  }

  return (
    <div className="min-h-dvh flex flex-col bg-[#020617] text-white">
      <PlayerHeader
        tournament={tournament}
        connected={true}
        meTeam={me}
        onSignOut={signOut}
      />

      <div className="flex-1 overflow-y-auto pb-24">
        <div className="max-w-md mx-auto w-full px-4 py-5">
          <h1 className="text-2xl font-bold tracking-wider uppercase text-white">
            My Portfolio
          </h1>

          <div className="mt-5 rounded-2xl bg-slate-800/70 border border-slate-700 p-5 text-center">
            <p className="text-4xl font-bold tabular-nums text-primary-400">
              {formatCents(total)}
            </p>
            <p className="mt-1 text-sm text-slate-400">
              invested across {entries.length} team{entries.length !== 1 ? 's' : ''}
            </p>
          </div>

          {entries.length === 0 ? (
            <div className="mt-8 text-center py-10">
              <p className="text-slate-400 font-semibold">No teams owned yet</p>
              <p className="mt-1 text-sm text-slate-500">
                Bid on a team in the auction to see it here.
              </p>
            </div>
          ) : (
            <div className="mt-5 space-y-3">
              {entries.map((e) => (
                <div
                  key={e.id}
                  className="rounded-2xl bg-slate-800/70 border border-slate-700 p-4"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h3 className="text-base font-bold uppercase tracking-wide truncate">
                        {e.team_name}
                      </h3>
                      {e.flight_name && (
                        <p className="text-xs text-slate-400 mt-0.5">
                          {e.flight_name}
                        </p>
                      )}
                    </div>
                    {!e.payment_confirmed && (
                      <span className="rounded-md bg-yellow-900/40 border border-yellow-700/50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-yellow-300 flex-shrink-0">
                        Payment Pending
                      </span>
                    )}
                  </div>
                  <div className="mt-3 grid grid-cols-3 gap-2">
                    <div className="rounded-lg bg-slate-900/60 px-3 py-2">
                      <p className="text-[10px] uppercase tracking-widest text-slate-500">
                        Ownership
                      </p>
                      <p className="mt-0.5 text-sm font-semibold tabular-nums">
                        {e.ownership_percentage}%
                      </p>
                    </div>
                    <div className="rounded-lg bg-slate-900/60 px-3 py-2">
                      <p className="text-[10px] uppercase tracking-widest text-slate-500">
                        Paid
                      </p>
                      <p className="mt-0.5 text-sm font-semibold tabular-nums">
                        {formatCents(e.paid_cents)}
                      </p>
                    </div>
                    <div className="rounded-lg bg-slate-900/60 px-3 py-2">
                      <p className="text-[10px] uppercase tracking-widest text-slate-500">
                        Proj. Win
                      </p>
                      <p className="mt-0.5 text-sm font-semibold tabular-nums text-primary-400">
                        {formatCents(e.projected_cents)}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <PlayerTabBar active="portfolio" />
    </div>
  )
}
