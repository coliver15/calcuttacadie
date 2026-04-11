// Diagnostic endpoint to debug why the display API returns stale data
import { NextRequest, NextResponse } from 'next/server'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export async function GET(_req: NextRequest) {
  const tournamentId = '6b139b88-5259-42f9-b3db-031cf9cef0c8'
  const now = new Date().toISOString()

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? 'MISSING'
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    ? `${process.env.SUPABASE_SERVICE_ROLE_KEY.substring(0, 20)}...`
    : 'MISSING'
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    ? `${process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY.substring(0, 20)}...`
    : 'MISSING'

  // Create a fresh admin client right here
  const db = createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!.trim(),
    process.env.SUPABASE_SERVICE_ROLE_KEY!.trim(),
    {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    }
  )

  // Query teams
  const { data: teams, error: teamsError } = await db
    .from('teams')
    .select('id, player1_name, auction_status, final_sale_price_cents, updated_at')
    .eq('tournament_id', tournamentId)
    .order('auction_order', { ascending: true })

  // Also try a raw RPC query
  const { data: rawResult, error: rawError } = await db.rpc('', undefined as any).maybeSingle()

  return NextResponse.json(
    {
      debug_timestamp: now,
      env: { supabaseUrl, serviceKeyPrefix: serviceKey, anonKeyPrefix: anonKey },
      teams_result: { data: teams, error: teamsError?.message ?? null },
      raw_teams_count: teams?.length ?? 0,
      team_statuses: teams?.map(t => ({ name: t.player1_name, status: t.auction_status, sale: t.final_sale_price_cents, updated: t.updated_at })),
    },
    { headers: { 'Cache-Control': 'no-store, no-cache, max-age=0', 'CDN-Cache-Control': 'no-store' } }
  )
}
