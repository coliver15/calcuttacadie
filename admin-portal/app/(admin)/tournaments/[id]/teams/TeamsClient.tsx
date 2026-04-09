'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import Button from '@/components/ui/Button'
import { Modal, ModalHeader, ModalBody } from '@/components/ui/Modal'
import Input, { Select } from '@/components/ui/Input'
import TeamTable from '@/components/teams/TeamTable'
import AddTeamForm from '@/components/teams/AddTeamForm'
import type { Flight, Team, TournamentStatus } from '@/types/database'

interface TeamsClientProps {
  tournamentId: string
  tournamentName: string
  tournamentStatus: TournamentStatus
  flights: Flight[]
  initialTeams: Team[]
}

export default function TeamsClient({
  tournamentId,
  tournamentName,
  tournamentStatus,
  flights,
  initialTeams,
}: TeamsClientProps) {
  const router = useRouter()
  const [teams, setTeams]           = useState<Team[]>(initialTeams)
  const [showAddModal, setShowAddModal] = useState(false)
  const [deleteTeam, setDeleteTeam]     = useState<Team | null>(null)
  const [editTeam, setEditTeam]         = useState<Team | null>(null)
  const [deleting, setDeleting]         = useState(false)
  const [editSaving, setEditSaving]     = useState(false)
  const [editError, setEditError]       = useState<string | null>(null)

  // Edit form state
  const [editForm, setEditForm] = useState({
    player1_name: '',
    player2_name: '',
    player1_handicap_index: '',
    player2_handicap_index: '',
    flight_id: '',
  })

  const isReadOnly =
    tournamentStatus === 'auction_live' ||
    tournamentStatus === 'auction_complete' ||
    tournamentStatus === 'complete'

  function openEdit(team: Team) {
    setEditTeam(team)
    setEditError(null)
    setEditForm({
      player1_name: team.player1_name,
      player2_name: team.player2_name,
      player1_handicap_index: team.player1_handicap_index?.toString() ?? '',
      player2_handicap_index: team.player2_handicap_index?.toString() ?? '',
      flight_id: team.flight_id ?? '',
    })
  }

  function handleAddSuccess(newTeam: Team) {
    setShowAddModal(false)
    setTeams((prev) => [...prev, newTeam])
  }

  async function confirmDelete() {
    if (!deleteTeam) return
    setDeleting(true)
    try {
      const res = await fetch(`/api/teams/${deleteTeam.id}`, { method: 'DELETE' })
      if (!res.ok) {
        const d = await res.json()
        throw new Error(d.error || 'Delete failed')
      }
      setTeams((prev) => prev.filter((t) => t.id !== deleteTeam.id))
      setDeleteTeam(null)
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Delete failed')
    } finally {
      setDeleting(false)
    }
  }

  async function saveEdit(e: React.FormEvent) {
    e.preventDefault()
    if (!editTeam) return
    setEditSaving(true)
    setEditError(null)
    try {
      const res = await fetch(`/api/teams/${editTeam.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          player1_name: editForm.player1_name.trim(),
          player2_name: editForm.player2_name.trim(),
          player1_handicap_index: editForm.player1_handicap_index
            ? parseFloat(editForm.player1_handicap_index) : null,
          player2_handicap_index: editForm.player2_handicap_index
            ? parseFloat(editForm.player2_handicap_index) : null,
          flight_id: editForm.flight_id || null,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Save failed')
      setTeams((prev) => prev.map((t) => t.id === editTeam.id ? data : t))
      setEditTeam(null)
    } catch (e) {
      setEditError(e instanceof Error ? e.message : 'Save failed')
    } finally {
      setEditSaving(false)
    }
  }

  const flightOptions = [
    { value: '', label: 'No flight' },
    ...flights.map((f) => ({ value: f.id, label: f.name })),
  ]

  return (
    <div className="px-4 sm:px-6 lg:px-8 py-8">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-slate-500 mb-6">
        <Link href="/dashboard" className="hover:text-slate-300 transition-colors">
          Tournaments
        </Link>
        <span>/</span>
        <Link href={`/tournaments/${tournamentId}`} className="hover:text-slate-300 transition-colors truncate">
          {tournamentName}
        </Link>
        <span>/</span>
        <span className="text-slate-300">Teams</span>
      </div>

      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white">Teams</h1>
          <p className="text-sm text-slate-400 mt-1">
            {teams.length} team{teams.length !== 1 ? 's' : ''} ·{' '}
            {flights.length} flight{flights.length !== 1 ? 's' : ''}
          </p>
        </div>
        {!isReadOnly && (
          <Button variant="primary" onClick={() => setShowAddModal(true)}>
            + Add Team
          </Button>
        )}
      </div>

      {flights.length === 0 && !isReadOnly && (
        <div className="mb-5 rounded-xl border border-yellow-700/50 bg-yellow-900/20 px-4 py-3 text-sm text-yellow-300">
          No flights configured yet.{' '}
          <Link href={`/tournaments/${tournamentId}/flights`} className="underline underline-offset-2 hover:text-yellow-200">
            Add flights
          </Link>{' '}
          to assign teams.
        </div>
      )}

      <TeamTable
        teams={teams}
        flights={flights}
        onEditTeam={isReadOnly ? undefined : openEdit}
        onDeleteTeam={isReadOnly ? undefined : (t) => setDeleteTeam(t)}
        showAccessCodes
        readOnly={isReadOnly}
      />

      {/* Add team modal */}
      <Modal open={showAddModal} onClose={() => setShowAddModal(false)} size="lg">
        <ModalHeader title="Add Team" description="Add a player pair to the auction" />
        <ModalBody>
          <AddTeamForm
            tournamentId={tournamentId}
            flights={flights}
            onSuccess={handleAddSuccess}
            onCancel={() => setShowAddModal(false)}
          />
        </ModalBody>
      </Modal>

      {/* Edit team modal */}
      <Modal open={editTeam !== null} onClose={() => setEditTeam(null)} size="lg">
        <ModalHeader title="Edit Team" description="Update player names, handicaps, or flight" />
        <ModalBody>
          <form onSubmit={saveEdit} className="space-y-4">
            {editError && (
              <div className="rounded-lg bg-red-950 border border-red-800 px-3 py-2 text-sm text-red-300">
                {editError}
              </div>
            )}
            <div className="grid grid-cols-2 gap-4">
              <Input
                label="Player 1 Name"
                value={editForm.player1_name}
                onChange={(e) => setEditForm((f) => ({ ...f, player1_name: e.target.value }))}
                required
              />
              <Input
                label="Player 2 Name"
                value={editForm.player2_name}
                onChange={(e) => setEditForm((f) => ({ ...f, player2_name: e.target.value }))}
                required
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <Input
                label="Player 1 Handicap Index"
                type="number"
                step="0.1"
                min="-10"
                max="54"
                value={editForm.player1_handicap_index}
                onChange={(e) => setEditForm((f) => ({ ...f, player1_handicap_index: e.target.value }))}
                hint="Optional · Use negative numbers for + handicaps (e.g. -2 = +2)"
              />
              <Input
                label="Player 2 Handicap Index"
                type="number"
                step="0.1"
                min="-10"
                max="54"
                value={editForm.player2_handicap_index}
                onChange={(e) => setEditForm((f) => ({ ...f, player2_handicap_index: e.target.value }))}
                hint="Optional"
              />
            </div>
            {flights.length > 0 && (
              <Select
                label="Flight"
                value={editForm.flight_id}
                onChange={(e) => setEditForm((f) => ({ ...f, flight_id: e.target.value }))}
                options={flightOptions}
              />
            )}
            <div className="flex justify-end gap-3 pt-2">
              <Button type="button" variant="ghost" onClick={() => setEditTeam(null)} disabled={editSaving}>
                Cancel
              </Button>
              <Button type="submit" variant="primary" loading={editSaving}>
                Save Changes
              </Button>
            </div>
          </form>
        </ModalBody>
      </Modal>

      {/* Delete confirmation */}
      <Modal open={deleteTeam !== null} onClose={() => setDeleteTeam(null)} size="sm">
        <ModalHeader title="Remove Team" />
        <ModalBody>
          <p className="text-sm text-slate-300">
            Remove{' '}
            <strong className="text-white">
              {deleteTeam?.player1_name} / {deleteTeam?.player2_name}
            </strong>{' '}
            from this tournament? This cannot be undone.
          </p>
        </ModalBody>
        <div className="flex items-center justify-end gap-3 border-t border-slate-700 px-6 py-4">
          <Button variant="ghost" onClick={() => setDeleteTeam(null)} disabled={deleting}>
            Cancel
          </Button>
          <Button variant="destructive" onClick={confirmDelete} loading={deleting}>
            Remove
          </Button>
        </div>
      </Modal>
    </div>
  )
}
