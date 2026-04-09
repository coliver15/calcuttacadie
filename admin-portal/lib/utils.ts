import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'
import { format, formatDistanceToNow } from 'date-fns'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatCents(cents: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(cents / 100)
}

export function formatDate(dateStr: string): string {
  return format(new Date(dateStr), 'MMM d, yyyy')
}

export function formatDateTime(dateStr: string): string {
  return format(new Date(dateStr), 'MMM d, yyyy h:mm a')
}

export function formatTimeAgo(dateStr: string): string {
  return formatDistanceToNow(new Date(dateStr), { addSuffix: true })
}

export function generateAccessCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  let code = ''
  for (let i = 0; i < 6; i++) {
    code += chars[Math.floor(Math.random() * chars.length)]
  }
  return code
}

export function formatHandicap(index: number | null): string {
  if (index === null) return '—'
  return index >= 0 ? `+${index.toFixed(1)}` : index.toFixed(1)
}

export function formatTimerSeconds(seconds: number): string {
  const mins = Math.floor(seconds / 60)
  const secs = seconds % 60
  if (mins > 0) {
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }
  return `0:${secs.toString().padStart(2, '0')}`
}

export function computeTimerRemaining(
  timerStartedAt: string | null,
  timerDurationSeconds: number
): number {
  if (!timerStartedAt) return timerDurationSeconds
  const startedAt = new Date(timerStartedAt).getTime()
  const now = Date.now()
  const elapsed = Math.floor((now - startedAt) / 1000)
  return Math.max(0, timerDurationSeconds - elapsed)
}

export function getTournamentStatusLabel(
  status: string
): { label: string; color: string } {
  switch (status) {
    case 'draft':
      return { label: 'Draft', color: 'slate' }
    case 'published':
      return { label: 'Published', color: 'blue' }
    case 'auction_open':
      return { label: 'Live Auction', color: 'green' }
    case 'auction_complete':
      return { label: 'Auction Complete', color: 'yellow' }
    case 'results_final':
      return { label: 'Results Final', color: 'purple' }
    default:
      return { label: status, color: 'slate' }
  }
}
