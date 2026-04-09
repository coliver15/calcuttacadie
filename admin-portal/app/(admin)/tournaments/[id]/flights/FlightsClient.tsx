'use client'

import { useState } from 'react'
import Link from 'next/link'
import Button from '@/components/ui/Button'
import Input from '@/components/ui/Input'
import { Modal, ModalHeader, ModalBody, ModalFooter } from '@/components/ui/Modal'
import { createClient } from '@/lib/supabase/client'
import type { Flight, FlightPayoutTier, TournamentStatus } from '@/types/database'
import { cn } from '@/lib/utils'

interface FlightsClientProps {
  tournamentId: string
  tournamentName: string
  tournamentStatus: TournamentStatus
  initialFlights: Flight[]
  initialPayoutTiers: FlightPayoutTier[]
}

interface PayoutEntry {
  place: number
  percentage: string
}

export default function FlightsClient({
  tournamentId,
  tournamentName,
  tournamentStatus,
  initialFlights,
  initialPayoutTiers,
}: FlightsClientProps) {
  const [flights, setFlights] = useState<Flight[]>(initialFlights)
  const [payoutTiers, setPayoutTiers] = useState<FlightPayoutTier[]>(initialPayoutTiers)

  const [showAddFlight, setShowAddFlight] = useState(false)
  const [newFlightName, setNewFlightName] = useState('')
  const [addingFlight, setAddingFlight] = useState(false)
  const [addFlightError, setAddFlightError] = useState<string | null>(null)

  const [editingFlightId, setEditingFlightId] = useState<string | null>(null)
  const [payoutEntries, setPayoutEntries] = useState<PayoutEntry[]>([])
  const [savingPayouts, setSavingPayouts] = useState(false)
  const [payoutError, setPayoutError] = useState<string | null>(null)

  const isReadOnly =
    tournamentStatus === 'auction_live' ||
    tournamentStatus === 'auction_complete' ||
    tournamentStatus === 'complete'

  function getTiers(flightId: string) {
    return payoutTiers
      .filter((t) => t.flight_id === flightId)
      .sort((a, b) => a.place - b.place)
  }

  function getTierTotal(flightId: string) {
    return getTiers(flightId).reduce((sum, t) => sum + t.percentage, 0)
  }

  async function handleAddFlight() {
    if (!newFlightName.trim()) {
      setAddFlightError('Flight name is required')
      return
    }
    setAddingFlight(true)
    setAddFlightError(null)

    const supabase = createClient()
    const { data, error } = await supabase
      .from('flights')
      .insert({
        tournament_id: tournamentId,
        name: newFlightName.trim(),
        display_order: flights.length + 1,
      })
      .select('*')
      .single()

    if (error) {
      setAddFlightError(error.message)
    } else {
      setFlights((prev) => [...prev, data as Flight])
      setNewFlightName('')
      setShowAddFlight(false)
    }
    setAddingFlight(false)
  }

  async function handleDeleteFlight(flight: Flight) {
    const supabase = createClient()
    await supabase.from('flights').delete().eq('id', flight.id)
    setFlights((prev) => prev.filter((f) => f.id !== flight.id))
    setPayoutTiers((prev) => prev.filter((t) => t.flight_id !== flight.id))
  }

  function openPayoutEditor(flight: Flight) {
    const existing = getTiers(flight.id)
    if (existing.length > 0) {
      setPayoutEntries(
        existing.map((t) => ({ place: t.place, percentage: t.percentage.toString() }))
      )
    } else {
      setPayoutEntries([
        { place: 1, percentage: '60' },
        { place: 2, percentage: '30' },
        { place: 3, percentage: '10' },
      ])
    }
    setEditingFlightId(flight.id)
    setPayoutError(null)
  }

  function updatePayoutEntry(index: number, field: keyof PayoutEntry, value: string) {
    setPayoutEntries((prev) =>
      prev.map((e, i) => (i === index ? { ...e, [field]: value } : e))
    )
  }

  function addPayoutRow() {
    const nextPlace = payoutEntries.length + 1
    setPayoutEntries((prev) => [...prev, { place: nextPlace, percentage: '0' }])
  }

  function removePayoutRow(index: number) {
    setPayoutEntries((prev) =>
      prev
        .filter((_, i) => i !== index)
        .map((e, i) => ({ ...e, place: i + 1 }))
    )
  }

  async function savePayouts() {
    if (!editingFlightId) return

    const total = payoutEntries.reduce((sum, e) => sum + parseFloat(e.percentage || '0'), 0)
    if (Math.abs(total - 100) > 0.01) {
      setPayoutError(`Percentages must sum to 100% (currently ${total.toFixed(1)}%)`)
      return
    }

    setSavingPayouts(true)
    setPayoutError(null)

    const supabase = createClient()
    // Delete existing tiers
    await supabase.from('flight_payout_tiers').delete().eq('flight_id', editingFlightId)

    // Insert new tiers
    const { data, error } = await supabase
      .from('flight_payout_tiers')
      .insert(
        payoutEntries.map((e) => ({
          flight_id: editingFlightId,
          place: e.place,
          percentage: parseFloat(e.percentage),
        }))
      )
      .select('*')

    if (error) {
      setPayoutError(error.message)
    } else {
      setPayoutTiers((prev) => [
        ...prev.filter((t) => t.flight_id !== editingFlightId),
        ...(data as FlightPayoutTier[]),
      ])
      setEditingFlightId(null)
    }
    setSavingPayouts(false)
  }

  const editingFlight = flights.find((f) => f.id === editingFlightId)
  const payoutTotal = payoutEntries.reduce(
    (sum, e) => sum + parseFloat(e.percentage || '0'),
    0
  )

  return (
    <div className="px-4 sm:px-6 lg:px-8 py-8 max-w-3xl">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-slate-500 mb-6">
        <Link href="/dashboard" className="hover:text-slate-300 transition-colors">
          Tournaments
        </Link>
        <span>/</span>
        <Link
          href={`/tournaments/${tournamentId}`}
          className="hover:text-slate-300 transition-colors truncate"
        >
          {tournamentName}
        </Link>
        <span>/</span>
        <span className="text-slate-300">Flights</span>
      </div>

      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white">Flights & Payouts</h1>
          <p className="text-sm text-slate-400 mt-1">
            Configure flights and payout percentage tiers
          </p>
        </div>
        {!isReadOnly && (
          <Button variant="primary" onClick={() => setShowAddFlight(true)}>
            + Add Flight
          </Button>
        )}
      </div>

      {flights.length === 0 ? (
        <div className="rounded-xl border border-slate-700 bg-slate-900 p-10 text-center">
          <p className="text-slate-400 text-sm mb-4">
            No flights created yet. Add a flight to get started.
          </p>
          {!isReadOnly && (
            <Button variant="outline" onClick={() => setShowAddFlight(true)}>
              + Add First Flight
            </Button>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          {flights.map((flight) => {
            const tiers = getTiers(flight.id)
            const total = getTierTotal(flight.id)
            const isValid = Math.abs(total - 100) < 0.01

            return (
              <div
                key={flight.id}
                className="rounded-xl border border-slate-700 bg-slate-900 overflow-hidden"
              >
                {/* Flight header */}
                <div className="flex items-center justify-between px-5 py-4 border-b border-slate-700/60">
                  <div className="flex items-center gap-3">
                    <h3 className="font-semibold text-white">{flight.name}</h3>
                    {tiers.length > 0 ? (
                      <span
                        className={cn(
                          'text-xs rounded-full px-2 py-0.5 font-medium ring-1 ring-inset',
                          isValid
                            ? 'bg-primary-900/60 text-primary-300 ring-primary-700'
                            : 'bg-yellow-900/60 text-yellow-300 ring-yellow-700'
                        )}
                      >
                        {isValid ? '✓ 100%' : `${total.toFixed(1)}%`}
                      </span>
                    ) : (
                      <span className="text-xs text-slate-500">No payouts set</span>
                    )}
                  </div>
                  {!isReadOnly && (
                    <div className="flex gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => openPayoutEditor(flight)}
                      >
                        Edit Payouts
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDeleteFlight(flight)}
                        className="text-red-400 hover:text-red-300"
                      >
                        Delete
                      </Button>
                    </div>
                  )}
                </div>

                {/* Payout tiers */}
                {tiers.length > 0 ? (
                  <div className="px-5 py-4">
                    <div className="space-y-2">
                      {tiers.map((tier) => (
                        <div
                          key={tier.id}
                          className="flex items-center justify-between text-sm"
                        >
                          <span className="text-slate-400">
                            {tier.place === 1
                              ? '1st Place'
                              : tier.place === 2
                              ? '2nd Place'
                              : tier.place === 3
                              ? '3rd Place'
                              : `${tier.place}th Place`}
                          </span>
                          <span className="font-medium text-white tabular-nums">
                            {tier.percentage}%
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="px-5 py-4 text-sm text-slate-500">
                    Click &ldquo;Edit Payouts&rdquo; to add payout tiers
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* Add flight modal */}
      <Modal open={showAddFlight} onClose={() => setShowAddFlight(false)} size="sm">
        <ModalHeader title="Add Flight" />
        <ModalBody>
          {addFlightError && (
            <div className="mb-4 text-sm text-red-400">{addFlightError}</div>
          )}
          <Input
            label="Flight Name"
            value={newFlightName}
            onChange={(e) => setNewFlightName(e.target.value)}
            placeholder="e.g. A Flight, Championship, Open"
            autoFocus
            onKeyDown={(e) => e.key === 'Enter' && handleAddFlight()}
          />
        </ModalBody>
        <ModalFooter>
          <Button variant="ghost" onClick={() => setShowAddFlight(false)}>
            Cancel
          </Button>
          <Button variant="primary" onClick={handleAddFlight} loading={addingFlight}>
            Add Flight
          </Button>
        </ModalFooter>
      </Modal>

      {/* Payout editor modal */}
      <Modal
        open={editingFlightId !== null}
        onClose={() => setEditingFlightId(null)}
        size="md"
      >
        <ModalHeader
          title={`Edit Payouts — ${editingFlight?.name ?? ''}`}
          description="Percentages must sum to exactly 100%"
        />
        <ModalBody className="space-y-4">
          {payoutError && (
            <div className="rounded-lg bg-red-900/30 border border-red-700/50 px-4 py-3 text-sm text-red-300">
              {payoutError}
            </div>
          )}

          <div className="space-y-2">
            {payoutEntries.map((entry, index) => (
              <div key={index} className="flex items-center gap-3">
                <span className="w-20 text-sm text-slate-400 flex-shrink-0">
                  {entry.place === 1
                    ? '1st Place'
                    : entry.place === 2
                    ? '2nd Place'
                    : entry.place === 3
                    ? '3rd Place'
                    : `${entry.place}th`}
                </span>
                <Input
                  type="number"
                  min="0"
                  max="100"
                  step="0.1"
                  value={entry.percentage}
                  onChange={(e) => updatePayoutEntry(index, 'percentage', e.target.value)}
                  className="text-right"
                />
                <span className="text-slate-400 text-sm">%</span>
                <button
                  onClick={() => removePayoutRow(index)}
                  className="text-slate-500 hover:text-red-400 text-sm transition-colors"
                  aria-label="Remove row"
                >
                  ✕
                </button>
              </div>
            ))}
          </div>

          <Button variant="ghost" size="sm" onClick={addPayoutRow}>
            + Add Place
          </Button>

          <div
            className={cn(
              'flex items-center justify-between rounded-lg px-4 py-3 text-sm font-semibold',
              Math.abs(payoutTotal - 100) < 0.01
                ? 'bg-primary-900/30 text-primary-300'
                : 'bg-slate-800 text-slate-300'
            )}
          >
            <span>Total</span>
            <span>{payoutTotal.toFixed(1)}%</span>
          </div>
        </ModalBody>
        <ModalFooter>
          <Button variant="ghost" onClick={() => setEditingFlightId(null)}>
            Cancel
          </Button>
          <Button variant="primary" onClick={savePayouts} loading={savingPayouts}>
            Save Payouts
          </Button>
        </ModalFooter>
      </Modal>
    </div>
  )
}
