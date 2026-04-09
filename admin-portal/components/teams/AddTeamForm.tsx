'use client'

import { useState } from 'react'
import Button from '@/components/ui/Button'
import Input, { Select } from '@/components/ui/Input'
import type { Flight, Team } from '@/types/database'

interface AddTeamFormProps {
  tournamentId: string
  flights: Flight[]
  onSuccess: (team: Team) => void
  onCancel?: () => void
}

interface FormState {
  player1_name: string
  player2_name: string
  player1_handicap_index: string
  player2_handicap_index: string
  flight_id: string
}

const initialState: FormState = {
  player1_name: '',
  player2_name: '',
  player1_handicap_index: '',
  player2_handicap_index: '',
  flight_id: '',
}

export default function AddTeamForm({
  tournamentId,
  flights,
  onSuccess,
  onCancel,
}: AddTeamFormProps) {
  const [form, setForm] = useState<FormState>(initialState)
  const [errors, setErrors] = useState<Partial<FormState>>({})
  const [loading, setLoading] = useState(false)
  const [serverError, setServerError] = useState<string | null>(null)

  const flightOptions = [
    { value: '', label: 'No flight assigned' },
    ...flights.map((f) => ({ value: f.id, label: f.name })),
  ]

  function set(field: keyof FormState, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }))
    setErrors((prev) => ({ ...prev, [field]: undefined }))
  }

  function validate(): boolean {
    const newErrors: Partial<FormState> = {}

    if (!form.player1_name.trim()) {
      newErrors.player1_name = 'Player 1 name is required'
    }
    if (!form.player2_name.trim()) {
      newErrors.player2_name = 'Player 2 name is required'
    }

    const hcp1 = parseFloat(form.player1_handicap_index)
    if (form.player1_handicap_index && (isNaN(hcp1) || hcp1 < -10 || hcp1 > 54)) {
      newErrors.player1_handicap_index = 'Enter a valid handicap index (-10 to 54)'
    }

    const hcp2 = parseFloat(form.player2_handicap_index)
    if (form.player2_handicap_index && (isNaN(hcp2) || hcp2 < -10 || hcp2 > 54)) {
      newErrors.player2_handicap_index = 'Enter a valid handicap index (-10 to 54)'
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!validate()) return

    setLoading(true)
    setServerError(null)

    try {
      const res = await fetch('/api/teams', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tournamentId,
          flight_id: form.flight_id || null,
          player1_name: form.player1_name.trim(),
          player2_name: form.player2_name.trim(),
          player1_handicap_index: form.player1_handicap_index
            ? parseFloat(form.player1_handicap_index) : null,
          player2_handicap_index: form.player2_handicap_index
            ? parseFloat(form.player2_handicap_index) : null,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to add team')

      setForm(initialState)
      onSuccess(data as Team)
    } catch (e) {
      setServerError(e instanceof Error ? e.message : 'Failed to add team')
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {serverError && (
        <div className="rounded-lg bg-red-900/30 border border-red-700/50 px-4 py-3 text-sm text-red-300">
          {serverError}
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Input
          label="Player 1 Name"
          value={form.player1_name}
          onChange={(e) => set('player1_name', e.target.value)}
          error={errors.player1_name}
          placeholder="John Smith"
          autoFocus
        />
        <Input
          label="Player 2 Name"
          value={form.player2_name}
          onChange={(e) => set('player2_name', e.target.value)}
          error={errors.player2_name}
          placeholder="Jane Doe"
        />
        <Input
          label="Player 1 Handicap Index"
          type="number"
          step="0.1"
          min="-10"
          max="54"
          value={form.player1_handicap_index}
          onChange={(e) => set('player1_handicap_index', e.target.value)}
          error={errors.player1_handicap_index}
          placeholder="e.g. 12.4"
          hint="Optional"
        />
        <Input
          label="Player 2 Handicap Index"
          type="number"
          step="0.1"
          min="-10"
          max="54"
          value={form.player2_handicap_index}
          onChange={(e) => set('player2_handicap_index', e.target.value)}
          error={errors.player2_handicap_index}
          placeholder="e.g. 8.1"
          hint="Optional"
        />
      </div>

      <Select
        label="Flight"
        options={flightOptions}
        value={form.flight_id}
        onChange={(e) => set('flight_id', e.target.value)}
      />

      <div className="flex items-center justify-end gap-3 pt-2">
        {onCancel && (
          <Button
            type="button"
            variant="ghost"
            onClick={onCancel}
            disabled={loading}
          >
            Cancel
          </Button>
        )}
        <Button type="submit" variant="primary" loading={loading}>
          Add Team
        </Button>
      </div>
    </form>
  )
}
