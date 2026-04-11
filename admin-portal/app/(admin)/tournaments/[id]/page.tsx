import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { TournamentStatusBadge } from '@/components/ui/Badge'
import Button from '@/components/ui/Button'
import { formatDate, formatCents } from '@/lib/utils'
import type { Tournament, Flight, Team, TournamentAdmin } from '@/types/database'
import type { Metadata } from 'next'
import TournamentActions from './TournamentActions'

export const dynamic = 'force-dynamic'
export const revalidate = 0

interface Props {
  params: { id: string }
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const supabase = createClient()
  const { data } = await supabase
    .from('tournaments')
    .select('name')
    .eq('id', params.id)
    .single()
  return { title: data?.name ?? 'Tournament' }
}

export default async function TournamentDetailPage({ params }: Props) {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/auth/login')

  // Verify access
  const { data: tournament } = await supabase
    .from('tournaments')
    .select('*')
    .eq('id', params.id)
    .single()

  if (!tournament) notFound()

  const { data: adminRecord } = await supabase
    .from('tournament_admins')
    .select('*')
    .eq('tournament_id', params.id)
    .eq('admin_id', user.id)
    .single()

  if (!adminRecord) notFound()

  const [
    { data: flights },
    { data: teams },
    { data: allAdmins },
  ] = await Promise.all([
    supabase
      .from('flights')
      .select('*')
      .eq('tournament_id', params.id)
      .order('display_order'),
    supabase
      .from('teams')
      .select('*')
      .eq('tournament_id', params.id),
    supabase
      .from('tournament_admins')
      .select('*')
      .eq('tournament_id', params.id),
  ])

  const t = tournament as Tournament
  const flightList = (flights as Flight[] | null) ?? []
  const teamList = (teams as Team[] | null) ?? []
  const adminList = (allAdmins as TournamentAdmin[] | null) ?? []

  const soldTeams = teamList.filter((t) => t.auction_status === 'sold')
  const totalPot = soldTeams.reduce(
    (sum, t) => sum + (t.final_sale_price_cents ?? 0),
    0
  )

  const isOwner = (adminRecord as TournamentAdmin).role === 'owner'

  const quickLinks = [
    {
      href: `/tournaments/${params.id}/teams`,
      label: 'Manage Teams',
      description: `${teamList.length} teams added`,
      icon: (
        <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
          <circle cx="7" cy="6" r="3" stroke="currentColor" strokeWidth="1.5" />
          <circle cx="14" cy="6" r="3" stroke="currentColor" strokeWidth="1.5" />
          <path d="M2 17c0-3 2-4.5 5-4.5s5 1.5 5 4.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          <path d="M14 12.5c2 0 4 1 4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
      ),
    },
    {
      href: `/tournaments/${params.id}/flights`,
      label: 'Flights & Payouts',
      description: `${flightList.length} flights configured`,
      icon: (
        <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
          <path d="M3 16l4-8 3 4 3-6 4 10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      ),
    },
    {
      href: `/tournaments/${params.id}/auction`,
      label: 'Live Auction',
      description:
        t.status === 'auction_live'
          ? 'Auction in progress'
          : 'Start the auction',
      icon: (
        <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
          <circle cx="10" cy="10" r="8" stroke="currentColor" strokeWidth="1.5" />
          <path d="M10 6v4l3 2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
      ),
      highlight: t.status === 'auction_live',
    },
    {
      href: `/tournaments/${params.id}/results`,
      label: 'Final Results',
      description:
        t.status === 'complete' ? 'Results finalized' : 'Enter placements',
      icon: (
        <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
          <path d="M7 3H5a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V5a2 2 0 00-2-2h-2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          <rect x="7" y="2" width="6" height="3" rx="1" stroke="currentColor" strokeWidth="1.5" />
          <path d="M7 10l2 2 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      ),
    },
  ]

  return (
    <div className="px-4 sm:px-6 lg:px-8 py-8 max-w-5xl">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-slate-500 mb-6">
        <Link href="/dashboard" className="hover:text-slate-300 transition-colors">
          Tournaments
        </Link>
        <span>/</span>
        <span className="text-slate-300 truncate">{t.name}</span>
      </div>

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 mb-8">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <h1 className="text-2xl font-bold text-white">{t.name}</h1>
            <TournamentStatusBadge status={t.status} />
          </div>
          <p className="text-slate-400">
            {t.club_name}
            {t.club_location && ` · ${t.club_location}`} ·{' '}
            {formatDate(t.tournament_date)}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <Link
            href={`/display/${params.id}`}
            target="_blank"
            rel="noopener noreferrer"
          >
            <Button variant="outline" size="sm">
              📺 Display View
            </Button>
          </Link>
          {isOwner && (
            <TournamentActions tournament={t} />
          )}
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-8">
        <div className="stat-card">
          <span className="stat-label">Teams</span>
          <span className="stat-value">{teamList.length}</span>
        </div>
        <div className="stat-card">
          <span className="stat-label">Flights</span>
          <span className="stat-value">{flightList.length}</span>
        </div>
        <div className="stat-card">
          <span className="stat-label">Sold</span>
          <span className="stat-value">{soldTeams.length}</span>
        </div>
        <div className="stat-card">
          <span className="stat-label">Total Pot</span>
          <span className="stat-value text-primary-400 text-xl">
            {formatCents(totalPot)}
          </span>
        </div>
      </div>

      {/* Quick links */}
      <div className="grid sm:grid-cols-2 gap-3 mb-8">
        {quickLinks.map((link) => (
          <Link
            key={link.href}
            href={link.href}
            className={`group flex items-center gap-4 rounded-xl border p-5 transition-all duration-150 ${
              link.highlight
                ? 'border-primary-700/60 bg-primary-950/30 hover:bg-primary-900/30'
                : 'border-slate-700 bg-slate-900 hover:bg-slate-800/60 hover:border-slate-600'
            }`}
          >
            <div
              className={`flex h-10 w-10 items-center justify-center rounded-lg flex-shrink-0 ${
                link.highlight
                  ? 'bg-primary-900 text-primary-400'
                  : 'bg-slate-800 text-slate-400'
              } group-hover:scale-105 transition-transform`}
            >
              {link.icon}
            </div>
            <div className="min-w-0">
              <p
                className={`font-semibold text-sm ${
                  link.highlight ? 'text-primary-300' : 'text-white'
                }`}
              >
                {link.label}
              </p>
              <p className="text-xs text-slate-400 truncate">{link.description}</p>
            </div>
            <svg
              width="16"
              height="16"
              viewBox="0 0 16 16"
              fill="none"
              className="ml-auto text-slate-600 group-hover:text-slate-400 flex-shrink-0 transition-colors"
            >
              <path d="M6 3l5 5-5 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </Link>
        ))}
      </div>

      {/* Co-admins */}
      <div className="rounded-xl border border-slate-700 bg-slate-900 p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-semibold text-white">
            Administrators ({adminList.length}/3)
          </h2>
        </div>
        <div className="space-y-2">
          {adminList.map((admin) => (
            <div
              key={admin.id}
              className="flex items-center justify-between rounded-lg bg-slate-800/50 px-4 py-3"
            >
              <div className="flex items-center gap-3">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-700 text-slate-300 text-sm font-semibold">
                  {admin.admin_id === user.id ? 'You' : '?'}
                </div>
                <div>
                  <p className="text-sm font-medium text-slate-200">
                    {admin.admin_id === user.id ? 'You' : `Admin ${admin.admin_id.slice(0, 8)}`}
                  </p>
                  <p className="text-xs text-slate-500 capitalize">{admin.role.replace('_', '-')}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
        {isOwner && adminList.length < 3 && (
          <p className="text-xs text-slate-500 mt-3">
            Co-admin management coming soon. Share the tournament ID with co-admins to grant access.
          </p>
        )}
      </div>
    </div>
  )
}
