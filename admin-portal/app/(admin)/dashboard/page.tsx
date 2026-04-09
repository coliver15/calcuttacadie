import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { TournamentStatusBadge } from '@/components/ui/Badge'
import Button from '@/components/ui/Button'
import { formatDate } from '@/lib/utils'
import type { Tournament, TournamentPurchase } from '@/types/database'
import type { Metadata } from 'next'

export const metadata: Metadata = { title: 'Dashboard' }

export default async function DashboardPage() {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  // Fetch tournaments where this admin is owner or co-admin
  const { data: tournaments } = await supabase
    .from('tournaments')
    .select('*')
    .eq('admin_id', user!.id)
    .order('tournament_date', { ascending: false })

  // Fetch remaining tournament credits
  const { data: purchases } = await supabase
    .from('tournament_purchases')
    .select('*')
    .eq('admin_id', user!.id)
    .eq('status', 'completed')
    .gt('tournaments_remaining', 0)
    .order('created_at', { ascending: true })

  const remainingCredits = (purchases as TournamentPurchase[] | null)?.reduce(
    (sum, p) => sum + p.tournaments_remaining,
    0
  ) ?? 0

  const tournamentList = (tournaments as Tournament[] | null) ?? []

  return (
    <div className="px-4 sm:px-6 lg:px-8 py-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
        <div>
          <h1 className="text-2xl font-bold text-white">Tournaments</h1>
          <p className="text-sm text-slate-400 mt-1">
            Manage your golf Calcutta tournaments
          </p>
        </div>
        <div className="flex items-center gap-3">
          {remainingCredits > 0 ? (
            <Link href="/tournaments/new">
              <Button variant="primary" size="md">
                + New Tournament
              </Button>
            </Link>
          ) : (
            <Link href="/billing">
              <Button variant="primary" size="md">
                Purchase Credits to Create Tournament
              </Button>
            </Link>
          )}
        </div>
      </div>

      {/* Credits banner */}
      {remainingCredits > 0 && (
        <div className="mb-6 flex items-center justify-between gap-4 rounded-xl border border-primary-800/50 bg-primary-950/30 px-5 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary-900 text-primary-400">
              <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
                <circle cx="9" cy="9" r="7.5" stroke="currentColor" strokeWidth="1.5" />
                <path d="M9 5v4l2.5 2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
            </div>
            <div>
              <p className="text-sm font-semibold text-primary-300">
                {remainingCredits} tournament credit{remainingCredits !== 1 ? 's' : ''} remaining
              </p>
              <p className="text-xs text-primary-400/70">Ready to create a new tournament</p>
            </div>
          </div>
          <Link
            href="/billing"
            className="text-xs text-primary-400 hover:text-primary-300 underline underline-offset-2 whitespace-nowrap"
          >
            Buy more
          </Link>
        </div>
      )}

      {/* No credits, no tournaments */}
      {tournamentList.length === 0 && remainingCredits === 0 && (
        <div className="rounded-2xl border border-slate-700/60 bg-slate-900 p-12 text-center">
          <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-xl bg-slate-800 text-slate-400">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
              <path d="M3 9h18M9 21V9M3 5a2 2 0 012-2h14a2 2 0 012 2v14a2 2 0 01-2 2H5a2 2 0 01-2-2V5z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          </div>
          <h2 className="text-lg font-semibold text-white mb-2">No tournaments yet</h2>
          <p className="text-slate-400 text-sm mb-6 max-w-sm mx-auto">
            Purchase a tournament credit to get started. Each credit lets you run one full Calcutta auction.
          </p>
          <Link href="/billing">
            <Button variant="primary" size="lg">
              Purchase Tournament Access
            </Button>
          </Link>
        </div>
      )}

      {/* Empty state with credits */}
      {tournamentList.length === 0 && remainingCredits > 0 && (
        <div className="rounded-2xl border border-slate-700/60 bg-slate-900 p-12 text-center">
          <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-xl bg-slate-800 text-slate-400">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
              <path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          </div>
          <h2 className="text-lg font-semibold text-white mb-2">Create your first tournament</h2>
          <p className="text-slate-400 text-sm mb-6 max-w-sm mx-auto">
            You have {remainingCredits} credit{remainingCredits !== 1 ? 's' : ''}. Get started by creating a tournament.
          </p>
          <Link href="/tournaments/new">
            <Button variant="primary" size="lg">
              + New Tournament
            </Button>
          </Link>
        </div>
      )}

      {/* Tournament list */}
      {tournamentList.length > 0 && (
        <div className="space-y-3">
          {tournamentList.map((tournament) => (
            <Link
              key={tournament.id}
              href={`/tournaments/${tournament.id}`}
              className="group flex flex-col sm:flex-row sm:items-center gap-4 rounded-xl border border-slate-700/60 bg-slate-900 px-5 py-4 hover:bg-slate-800/60 hover:border-slate-600 transition-all duration-150"
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-3 mb-1">
                  <h3 className="font-semibold text-white truncate group-hover:text-primary-300 transition-colors">
                    {tournament.name}
                  </h3>
                  <TournamentStatusBadge status={tournament.status} />
                </div>
                <p className="text-sm text-slate-400 truncate">
                  {tournament.club_name}
                  {tournament.club_location && ` · ${tournament.club_location}`}
                </p>
              </div>
              <div className="flex items-center gap-4 text-sm text-slate-400 flex-shrink-0">
                <span>{formatDate(tournament.tournament_date)}</span>
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 16 16"
                  fill="none"
                  className="text-slate-600 group-hover:text-slate-400 transition-colors"
                >
                  <path
                    d="M6 3l5 5-5 5"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
