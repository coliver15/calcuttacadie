'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Button from '@/components/ui/Button'
import { Modal, ModalHeader, ModalBody, ModalFooter } from '@/components/ui/Modal'
import { createClient } from '@/lib/supabase/client'
import type { Tournament, TournamentStatus } from '@/types/database'

interface TournamentActionsProps {
  tournament: Tournament
}

const STATUS_FLOW: Partial<Record<TournamentStatus, TournamentStatus>> = {
  draft: 'published',
  published: 'auction_open',
  auction_open: 'auction_complete',
  auction_complete: 'results_final',
}

const STATUS_BUTTON_LABEL: Partial<Record<TournamentStatus, string>> = {
  draft: 'Publish Tournament',
  published: 'Open Auction',
  auction_open: 'Close Auction',
  auction_complete: 'Finalize Results',
}

export default function TournamentActions({ tournament }: TournamentActionsProps) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [deleting, setDeleting] = useState(false)

  const nextStatus = STATUS_FLOW[tournament.status]
  const nextLabel = STATUS_BUTTON_LABEL[tournament.status]

  async function handleStatusChange() {
    if (!nextStatus) return
    setLoading(true)
    setError(null)

    const supabase = createClient()
    const { error: updateError } = await supabase
      .from('tournaments')
      .update({ status: nextStatus })
      .eq('id', tournament.id)

    if (updateError) {
      setError(updateError.message)
    } else {
      router.refresh()
    }
    setLoading(false)
  }

  async function handleDelete() {
    setDeleting(true)
    const supabase = createClient()
    await supabase.from('tournaments').delete().eq('id', tournament.id)
    router.push('/dashboard')
  }

  return (
    <>
      {error && (
        <p className="text-xs text-red-400 max-w-xs">{error}</p>
      )}
      {nextLabel && (
        <Button
          variant="primary"
          size="sm"
          onClick={handleStatusChange}
          loading={loading}
        >
          {nextLabel}
        </Button>
      )}
      {tournament.status === 'draft' && (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setShowDeleteModal(true)}
          className="text-red-400 hover:text-red-300"
        >
          Delete
        </Button>
      )}

      <Modal open={showDeleteModal} onClose={() => setShowDeleteModal(false)}>
        <ModalHeader
          title="Delete Tournament"
          description="This action cannot be undone."
        />
        <ModalBody>
          <p className="text-sm text-slate-300">
            Are you sure you want to delete{' '}
            <strong className="text-white">{tournament.name}</strong>? All
            associated teams, flights, and auction data will be permanently
            removed.
          </p>
        </ModalBody>
        <ModalFooter>
          <Button
            variant="ghost"
            onClick={() => setShowDeleteModal(false)}
            disabled={deleting}
          >
            Cancel
          </Button>
          <Button
            variant="destructive"
            onClick={handleDelete}
            loading={deleting}
          >
            Delete Tournament
          </Button>
        </ModalFooter>
      </Modal>
    </>
  )
}
