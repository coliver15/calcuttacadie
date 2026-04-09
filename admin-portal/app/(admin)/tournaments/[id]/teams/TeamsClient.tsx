'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import Button from '@/components/ui/Button'
import { Modal, ModalHeader, ModalBody } from '@/components/ui/Modal'
import TeamTable from '@/components/teams/TeamTable'
import AddTeamForm from '@/components/teams/AddTeamForm'
import { createClient } from '@/lib/supabase/client'
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
  const [teams, setTeams] = useState<Team[]>(initialTeams)
  const [showAddModal, setShowAddModal] = useState(false)
  const [deleteTeam, setDeleteTeam] = useState<Team | null>(null)
  const [deleting, setDeleting] = useState(false)

  const isReadOnly =
    tournamentStatus === 'auction_open' ||
    tournamentStatus === 'auction_complete' ||
    tournamentStatus === 'results_final'

  function handleSuccess() {
    setShowAddModal(false)
    router.refresh()
    // Optimistically reload from server
    const supabase = createClient()
    supabase
      .from('teams')
      .select('*')
      .eq('tournament_id', tournamentId)
      .order('auction_order', { ascending: true })
      .then(({ data }) => {
        if (data) setTeams(data as Team[])
      })
  }

  async function confirmDelete() {
    if (!deleteTeam) return
    setDeleting(true)
    const supabase = createClient()
    await supabase.from('teams').delete().eq('id', deleteTeam.id)
    setTeams((prev) => prev.filter((t) => t.id !== deleteTeam.id))
    setDeleteTeam(null)
    setDeleting(false)
  }

  return (
    <div className="px-4 sm:px-6 lg:px-8 py-8">
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
          <Link
            href={`/tournaments/${tournamentId}/flights`}
            className="underline underline-offset-2 hover:text-yellow-200"
          >
            Add flights
          </Link>{' '}
          to assign teams.
        </div>
      )}

      <TeamTable
        teams={teams}
        flights={flights}
        onEditTeam={isReadOnly ? undefined : undefined} // edit in modal — future enhancement
        onDeleteTeam={isReadOnly ? undefined : (t) => setDeleteTeam(t)}
        showAccessCodes
        readOnly={isReadOnly}
      />

      {/* Add team modal */}
      <Modal
        open={showAddModal}
        onClose={() => setShowAddModal(false)}
        size="lg"
      >
        <ModalHeader
          title="Add Team"
          description="Add a player pair to the auction"
        />
        <ModalBody>
          <AddTeamForm
            tournamentId={tournamentId}
            flights={flights}
            onSuccess={handleSuccess}
            onCancel={() => setShowAddModal(false)}
          />
        </ModalBody>
      </Modal>

      {/* Delete confirmation */}
      <Modal
        open={deleteTeam !== null}
        onClose={() => setDeleteTeam(null)}
        size="sm"
      >
        <ModalHeader title="Remove Team" />
        <ModalBody>
          <p className="text-sm text-slate-300">
            Remove{' '}
            <strong className="text-white">
              {deleteTeam?.player1_name} / {deleteTeam?.player2_name}
            </strong>{' '}
            from this tournament?
          </p>
        </ModalBody>
        <div className="flex items-center justify-end gap-3 border-t border-slate-700 px-6 py-4">
          <Button
            variant="ghost"
            onClick={() => setDeleteTeam(null)}
            disabled={deleting}
          >
            Cancel
          </Button>
          <Button
            variant="destructive"
            onClick={confirmDelete}
            loading={deleting}
          >
            Remove
          </Button>
        </div>
      </Modal>
    </div>
  )
}
