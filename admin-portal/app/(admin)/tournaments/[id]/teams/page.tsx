import { notFound, redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import type { Flight, Team } from '@/types/database'
import TeamsClient from './TeamsClient'
import type { Metadata } from 'next'

export const dynamic = 'force-dynamic'
export const revalidate = 0

interface Props {
  params: { id: string }
}

export const metadata: Metadata = { title: 'Manage Teams' }

export default async function TeamsPage({ params }: Props) {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/auth/login')

  // Verify access
  const { data: tournament } = await supabase
    .from('tournaments')
    .select('id, name, status')
    .eq('id', params.id)
    .single()

  if (!tournament) notFound()

  const { data: adminRecord } = await supabase
    .from('tournament_admins')
    .select('role')
    .eq('tournament_id', params.id)
    .eq('admin_id', user.id)
    .single()

  if (!adminRecord) notFound()

  const [{ data: flights }, { data: teams }] = await Promise.all([
    supabase
      .from('flights')
      .select('*')
      .eq('tournament_id', params.id)
      .order('display_order'),
    supabase
      .from('teams')
      .select('*')
      .eq('tournament_id', params.id)
      .order('auction_order', { ascending: true }),
  ])

  return (
    <TeamsClient
      tournamentId={params.id}
      tournamentName={tournament.name}
      tournamentStatus={tournament.status}
      flights={(flights as Flight[] | null) ?? []}
      initialTeams={(teams as Team[] | null) ?? []}
    />
  )
}
