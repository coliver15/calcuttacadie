import { notFound } from 'next/navigation'
import { createAdminClient } from '@/lib/supabase/server'
import type { Team, Tournament } from '@/types/database'
import PrintQrClient from './PrintQrClient'

export const dynamic = 'force-dynamic'

interface Props {
  params: { id: string }
}

export default async function PrintAllQrPage({ params }: Props) {
  const db = createAdminClient()
  const { data: tournament } = await db
    .from('tournaments')
    .select('*')
    .eq('id', params.id)
    .single()

  if (!tournament) notFound()

  const { data: teams } = await db
    .from('teams')
    .select('*')
    .eq('tournament_id', params.id)
    .order('auction_order', { ascending: true })

  return (
    <PrintQrClient
      tournament={tournament as Tournament}
      teams={(teams as Team[] | null) ?? []}
    />
  )
}
