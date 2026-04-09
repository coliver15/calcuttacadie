'use client'

import { useState } from 'react'
import Link from 'next/link'
import Button from '@/components/ui/Button'
import { Select } from '@/components/ui/Input'
import { createClient } from '@/lib/supabase/client'
import { formatCents } from '@/lib/utils'
import type {
  Tournament,
  Team,
  Flight,
  FlightPayoutTier,
  Ownership,
} from '@/types/database'

interface ResultsClientProps {
  tournament: Tournament
  teams: Team[]
  flights: Flight[]
  payoutTiers: FlightPayoutTier[]
  ownerships: Ownership[]
}

interface PlacementState {
  [teamId: string]: string // place number as string
}

interface WinningsState {
  [teamId: string]: number
}

export default function ResultsClient({
  tournament,
  teams,
  flights,
  payoutTiers,
  ownerships: initialOwnerships,
}: ResultsClientProps) {
  const [placements, setPlacements] = useState<PlacementState>(() => {
    const init: PlacementState = {}
    teams.forEach((t) => {
      if (t.final_place !== null) init[t.id] = t.final_place.toString()
    })
    return init
  })

  const [ownerships, setOwnerships] = useState<Ownership[]>(initialOwnerships)
  const [saving, setSaving] = useState(false)
  const [saveSuccess, setSaveSuccess] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const flightMap = new Map(flights.map((f) => [f.id, f]))

  // Group teams by flight
  const teamsByFlight = new Map<string | null, Team[]>()
  teams.forEach((team) => {
    const key = team.flight_id ?? null
    if (!teamsByFlight.has(key)) teamsByFlight.set(key, [])
    teamsByFlight.get(key)!.push(team)
  })

  // Calculate winnings for a team given placements
  function calculateWinnings(team: Team, place: number | null): number {
    if (place === null || !team.flight_id) return 0
    const flightTiers = payoutTiers.filter((t) => t.flight_id === team.flight_id)
    const tier = flightTiers.find((t) => t.place === place)
    if (!tier) return 0

    // Total pot for this flight
    const flightTeams = teams.filter(
      (t) => t.flight_id === team.flight_id && t.auction_status === 'sold'
    )
    const flightPot = flightTeams.reduce(
      (sum, t) => sum + (t.final_sale_price_cents ?? 0),
      0
    )
    return Math.round((flightPot * tier.percentage) / 100)
  }

  async function handleSavePlacements() {
    setSaving(true)
    setError(null)
    setSaveSuccess(false)

    const supabase = createClient()

    // Build updates
    const updates = teams
      .filter((t) => placements[t.id] !== undefined)
      .map((t) => {
        const place = placements[t.id] ? parseInt(placements[t.id]) : null
        const winnings = place !== null ? calculateWinnings(t, place) : null
        return { id: t.id, final_place: place, winnings_cents: winnings }
      })

    for (const update of updates) {
      const { error: updateError } = await supabase
        .from('teams')
        .update({
          final_place: update.final_place,
          winnings_cents: update.winnings_cents,
        })
        .eq('id', update.id)

      if (updateError) {
        setError(updateError.message)
        setSaving(false)
        return
      }
    }

    setSaving(false)
    setSaveSuccess(true)
    setTimeout(() => setSaveSuccess(false), 3000)
  }

  async function togglePaymentConfirmed(ownership: Ownership) {
    const supabase = createClient()
    const confirmed = !ownership.payment_confirmed
    const { error: updateError } = await supabase
      .from('ownerships')
      .update({
        payment_confirmed: confirmed,
        payment_confirmed_at: confirmed ? new Date().toISOString() : null,
      })
      .eq('id', ownership.id)

    if (!updateError) {
      setOwnerships((prev) =>
        prev.map((o) =>
          o.id === ownership.id
            ? { ...o, payment_confirmed: confirmed }
            : o
        )
      )
    }
  }

  const placeOptions = [
    { value: '', label: '— Not placed —' },
    ...Array.from({ length: 10 }, (_, i) => ({
      value: (i + 1).toString(),
      label:
        i === 0
          ? '1st Place'
          : i === 1
          ? '2nd Place'
          : i === 2
          ? '3rd Place'
          : `${i + 1}th Place`,
    })),
  ]

  const soldTeams = teams.filter((t) => t.auction_status === 'sold')

  return (
    <div className="px-4 sm:px-6 lg:px-8 py-8 max-w-5xl">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-slate-500 mb-6">
        <Link href="/dashboard" className="hover:text-slate-300 transition-colors">
          Tournaments
        </Link>
        <span>/</span>
        <Link
          href={`/tournaments/${tournament.id}`}
          className="hover:text-slate-300 transition-colors truncate"
        >
          {tournament.name}
        </Link>
        <span>/</span>
        <span className="text-slate-300">Results</span>
      </div>

      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
        <div>
          <h1 className="text-2xl font-bold text-white">Final Results</h1>
          <p className="text-sm text-slate-400 mt-1">
            Enter team placements to calculate winnings
          </p>
        </div>
        <Button
          variant="primary"
          onClick={handleSavePlacements}
          loading={saving}
        >
          {saveSuccess ? '✓ Saved' : 'Save Placements'}
        </Button>
      </div>

      {error && (
        <div className="mb-6 rounded-lg bg-red-900/30 border border-red-700/50 px-4 py-3 text-sm text-red-300">
          {error}
        </div>
      )}

      {/* Placements by flight */}
      {flights.length > 0 ? (
        <div className="space-y-6 mb-10">
          {flights.map((flight) => {
            const flightTeams = teamsByFlight.get(flight.id) ?? []
            if (flightTeams.length === 0) return null

            return (
              <div
                key={flight.id}
                className="rounded-xl border border-slate-700 bg-slate-900 overflow-hidden"
              >
                <div className="px-5 py-4 border-b border-slate-700">
                  <h2 className="font-semibold text-white">{flight.name}</h2>
                </div>
                <div className="divide-y divide-slate-800">
                  {flightTeams.map((team) => {
                    const place = placements[team.id]
                      ? parseInt(placements[team.id])
                      : null
                    const winnings = place !== null ? calculateWinnings(team, place) : null

                    return (
                      <div
                        key={team.id}
                        className="flex flex-col sm:flex-row sm:items-center gap-3 px-5 py-4"
                      >
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-white">
                            {team.player1_name} / {team.player2_name}
                          </p>
                          {team.final_sale_price_cents !== null && (
                            <p className="text-xs text-slate-400">
                              Sold for {formatCents(team.final_sale_price_cents)}
                            </p>
                          )}
                        </div>
                        <div className="flex items-center gap-4">
                          <div className="w-40">
                            <Select
                              options={placeOptions}
                              value={placements[team.id] ?? ''}
                              onChange={(e) =>
                                setPlacements((prev) => ({
                                  ...prev,
                                  [team.id]: e.target.value,
                                }))
                              }
                            />
                          </div>
                          {winnings !== null && winnings > 0 && (
                            <span className="font-mono text-sm font-semibold text-primary-300 w-24 text-right">
                              {formatCents(winnings)}
                            </span>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )
          })}
        </div>
      ) : (
        <div className="mb-10 rounded-xl border border-slate-700 bg-slate-900 p-8 text-center text-slate-400 text-sm">
          No flights configured. Teams need flights for payout calculations.
        </div>
      )}

      {/* Ownership & Payments */}
      {soldTeams.length > 0 && (
        <div>
          <h2 className="text-lg font-semibold text-white mb-4">
            Ownership & Payments
          </h2>
          <div className="rounded-xl border border-slate-700 overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-slate-800/80 border-b border-slate-700">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider">
                    Team
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider">
                    Owner
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider">
                    Amount
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider">
                    Payment
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {soldTeams.map((team) => {
                  const teamOwnerships = ownerships.filter(
                    (o) => o.team_id === team.id
                  )

                  if (teamOwnerships.length === 0) {
                    return (
                      <tr key={team.id}>
                        <td className="px-4 py-3 text-slate-300">
                          {team.player1_name} / {team.player2_name}
                        </td>
                        <td
                          colSpan={3}
                          className="px-4 py-3 text-slate-500 text-xs"
                        >
                          No ownership records
                        </td>
                      </tr>
                    )
                  }

                  return teamOwnerships.map((ownership, idx) => (
                    <tr key={ownership.id}>
                      {idx === 0 && (
                        <td
                          className="px-4 py-3 text-slate-200 align-top"
                          rowSpan={teamOwnerships.length}
                        >
                          <p className="font-medium">{team.player1_name}</p>
                          <p className="text-slate-400">{team.player2_name}</p>
                        </td>
                      )}
                      <td className="px-4 py-3 text-slate-300 text-xs">
                        Team {ownership.owner_team_id.slice(0, 8)}
                        {ownership.ownership_percentage < 100 && (
                          <span className="ml-1 text-slate-500">
                            ({ownership.ownership_percentage}%)
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 font-mono text-slate-300">
                        {formatCents(ownership.amount_paid_cents)}
                      </td>
                      <td className="px-4 py-3">
                        <button
                          onClick={() => togglePaymentConfirmed(ownership)}
                          className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium ring-1 ring-inset transition-colors ${
                            ownership.payment_confirmed
                              ? 'bg-primary-900/60 text-primary-300 ring-primary-700 hover:bg-primary-900'
                              : 'bg-slate-800 text-slate-400 ring-slate-700 hover:bg-slate-700'
                          }`}
                        >
                          {ownership.payment_confirmed ? '✓ Confirmed' : 'Mark Paid'}
                        </button>
                      </td>
                    </tr>
                  ))
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
