'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import Button from '@/components/ui/Button'
import Input, { Select } from '@/components/ui/Input'
import type { AuctionOrderType } from '@/types/database'
import type { Metadata } from 'next'

const AUCTION_ORDER_OPTIONS = [
  { value: 'random', label: 'Random order' },
  { value: 'manual', label: 'Manual (set order per team)' },
  { value: 'handicap_desc', label: 'Handicap descending (highest first)' },
  { value: 'handicap_asc', label: 'Handicap ascending (lowest first)' },
]

interface FormState {
  name: string
  club_name: string
  club_location: string
  tournament_date: string
  timer_duration_seconds: string
  timer_extension_seconds: string
  timer_extension_threshold_seconds: string
  min_bid_increment_cents: string
  auction_order_type: AuctionOrderType
}

const initialState: FormState = {
  name: '',
  club_name: '',
  club_location: '',
  tournament_date: '',
  timer_duration_seconds: '120',
  timer_extension_seconds: '30',
  timer_extension_threshold_seconds: '15',
  min_bid_increment_cents: '5000',
  auction_order_type: 'random',
}

export default function NewTournamentPage() {
  const router = useRouter()
  const [form, setForm] = useState<FormState>(initialState)
  const [errors, setErrors] = useState<Partial<FormState>>({})
  const [loading, setLoading] = useState(false)
  const [serverError, setServerError] = useState<string | null>(null)

  function set(field: keyof FormState, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }))
    setErrors((prev) => ({ ...prev, [field]: undefined }))
  }

  function validate(): boolean {
    const newErrors: Partial<FormState> = {}

    if (!form.name.trim()) newErrors.name = 'Tournament name is required'
    if (!form.club_name.trim()) newErrors.club_name = 'Club name is required'
    if (!form.tournament_date) newErrors.tournament_date = 'Tournament date is required'

    const timerDuration = parseInt(form.timer_duration_seconds)
    if (isNaN(timerDuration) || timerDuration < 30 || timerDuration > 600) {
      newErrors.timer_duration_seconds = 'Enter a timer duration between 30 and 600 seconds'
    }

    const timerExtension = parseInt(form.timer_extension_seconds)
    if (isNaN(timerExtension) || timerExtension < 5 || timerExtension > 120) {
      newErrors.timer_extension_seconds = 'Extension must be between 5 and 120 seconds'
    }

    const minBid = parseInt(form.min_bid_increment_cents)
    if (isNaN(minBid) || minBid < 100) {
      newErrors.min_bid_increment_cents = 'Minimum bid must be at least $1 (100 cents)'
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!validate()) return

    setLoading(true)
    setServerError(null)

    const supabase = createClient()

    // Check if user has available credits
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      router.push('/auth/login')
      return
    }

    // Find an available purchase
    const { data: purchases } = await supabase
      .from('tournament_purchases')
      .select('*')
      .eq('admin_id', user.id)
      .eq('status', 'completed')
      .gt('tournaments_remaining', 0)
      .order('created_at', { ascending: true })
      .limit(1)

    if (!purchases || purchases.length === 0) {
      setServerError(
        'No tournament credits available. Please purchase credits from the Billing page.'
      )
      setLoading(false)
      return
    }

    const purchase = purchases[0]

    try {
      // Create the tournament
      const { data: tournament, error: tournamentError } = await supabase
        .from('tournaments')
        .insert({
          admin_id: user.id,
          name: form.name.trim(),
          club_name: form.club_name.trim(),
          club_location: form.club_location.trim() || null,
          tournament_date: form.tournament_date,
          status: 'draft',
          timer_duration_seconds: parseInt(form.timer_duration_seconds),
          timer_extension_seconds: parseInt(form.timer_extension_seconds),
          timer_extension_threshold_seconds: parseInt(form.timer_extension_threshold_seconds),
          min_bid_increment_cents: parseInt(form.min_bid_increment_cents),
          auction_order_type: form.auction_order_type,
          current_auction_session_id: null,
        })
        .select('id')
        .single()

      if (tournamentError) throw new Error(tournamentError.message)

      // Decrement the credit
      await supabase
        .from('tournament_purchases')
        .update({ tournaments_remaining: purchase.tournaments_remaining - 1 })
        .eq('id', purchase.id)

      // Add owner as tournament admin
      await supabase.from('tournament_admins').insert({
        tournament_id: tournament.id,
        admin_id: user.id,
        role: 'owner',
      })

      router.push(`/tournaments/${tournament.id}`)
    } catch (e) {
      setServerError(e instanceof Error ? e.message : 'Failed to create tournament')
      setLoading(false)
    }
  }

  return (
    <div className="px-4 sm:px-6 lg:px-8 py-8 max-w-2xl">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-white">New Tournament</h1>
        <p className="text-sm text-slate-400 mt-1">
          Configure your Calcutta tournament settings
        </p>
      </div>

      {serverError && (
        <div className="mb-6 rounded-lg bg-red-900/30 border border-red-700/50 px-4 py-3 text-sm text-red-300">
          {serverError}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Basic info */}
        <div className="rounded-xl border border-slate-700 bg-slate-900 p-6 space-y-5">
          <h2 className="text-base font-semibold text-white">Tournament Details</h2>
          <Input
            label="Tournament Name"
            value={form.name}
            onChange={(e) => set('name', e.target.value)}
            error={errors.name}
            placeholder="Spring Club Championship Calcutta"
            required
          />
          <div className="grid sm:grid-cols-2 gap-4">
            <Input
              label="Club Name"
              value={form.club_name}
              onChange={(e) => set('club_name', e.target.value)}
              error={errors.club_name}
              placeholder="Pebble Beach Golf Links"
              required
            />
            <Input
              label="Location"
              value={form.club_location}
              onChange={(e) => set('club_location', e.target.value)}
              error={errors.club_location}
              placeholder="Pebble Beach, CA"
            />
          </div>
          <Input
            label="Tournament Date"
            type="date"
            value={form.tournament_date}
            onChange={(e) => set('tournament_date', e.target.value)}
            error={errors.tournament_date}
            required
          />
        </div>

        {/* Auction settings */}
        <div className="rounded-xl border border-slate-700 bg-slate-900 p-6 space-y-5">
          <h2 className="text-base font-semibold text-white">Auction Settings</h2>

          <Select
            label="Auction Order"
            options={AUCTION_ORDER_OPTIONS}
            value={form.auction_order_type}
            onChange={(e) => set('auction_order_type', e.target.value as AuctionOrderType)}
          />

          <div className="grid sm:grid-cols-2 gap-4">
            <Input
              label="Timer Duration (seconds)"
              type="number"
              min="30"
              max="600"
              value={form.timer_duration_seconds}
              onChange={(e) => set('timer_duration_seconds', e.target.value)}
              error={errors.timer_duration_seconds}
              hint="Time for each team's bidding (30–600s)"
            />
            <Input
              label="Timer Extension (seconds)"
              type="number"
              min="5"
              max="120"
              value={form.timer_extension_seconds}
              onChange={(e) => set('timer_extension_seconds', e.target.value)}
              error={errors.timer_extension_seconds}
              hint="Extra time added when bid placed near end"
            />
          </div>

          <div className="grid sm:grid-cols-2 gap-4">
            <Input
              label="Extension Threshold (seconds)"
              type="number"
              min="5"
              max="60"
              value={form.timer_extension_threshold_seconds}
              onChange={(e) => set('timer_extension_threshold_seconds', e.target.value)}
              hint="Bid within N seconds remaining triggers extension"
            />
            <Input
              label="Minimum Bid Increment (cents)"
              type="number"
              min="100"
              step="100"
              value={form.min_bid_increment_cents}
              onChange={(e) => set('min_bid_increment_cents', e.target.value)}
              error={errors.min_bid_increment_cents}
              hint="e.g. 5000 = $50 minimum raise"
            />
          </div>
        </div>

        <div className="flex items-center justify-end gap-3">
          <Button
            type="button"
            variant="ghost"
            onClick={() => router.back()}
            disabled={loading}
          >
            Cancel
          </Button>
          <Button type="submit" variant="primary" size="lg" loading={loading}>
            Create Tournament
          </Button>
        </div>
      </form>
    </div>
  )
}
