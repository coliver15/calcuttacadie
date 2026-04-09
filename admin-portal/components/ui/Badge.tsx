import { type HTMLAttributes } from 'react'
import { cn } from '@/lib/utils'
import type { TournamentStatus } from '@/types/database'

export type BadgeVariant =
  | 'default'
  | 'success'
  | 'warning'
  | 'danger'
  | 'info'
  | 'purple'
  | 'slate'

interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  variant?: BadgeVariant
}

const variantClasses: Record<BadgeVariant, string> = {
  default: 'bg-slate-700 text-slate-200 ring-slate-600',
  success: 'bg-primary-900/60 text-primary-300 ring-primary-700',
  warning: 'bg-yellow-900/60 text-yellow-300 ring-yellow-700',
  danger: 'bg-red-900/60 text-red-300 ring-red-700',
  info: 'bg-blue-900/60 text-blue-300 ring-blue-700',
  purple: 'bg-purple-900/60 text-purple-300 ring-purple-700',
  slate: 'bg-slate-800 text-slate-300 ring-slate-700',
}

export function Badge({ className, variant = 'default', children, ...props }: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset',
        variantClasses[variant],
        className
      )}
      {...props}
    >
      {children}
    </span>
  )
}

// Tournament-specific status badge
const statusVariantMap: Record<TournamentStatus, BadgeVariant> = {
  draft: 'slate',
  published: 'info',
  auction_open: 'success',
  auction_complete: 'warning',
  results_final: 'purple',
}

const statusLabelMap: Record<TournamentStatus, string> = {
  draft: 'Draft',
  published: 'Published',
  auction_open: 'Live Auction',
  auction_complete: 'Auction Complete',
  results_final: 'Results Final',
}

interface TournamentStatusBadgeProps {
  status: TournamentStatus
  showDot?: boolean
}

export function TournamentStatusBadge({
  status,
  showDot = true,
}: TournamentStatusBadgeProps) {
  const variant = statusVariantMap[status]
  const label = statusLabelMap[status]

  return (
    <Badge variant={variant}>
      {showDot && status === 'auction_open' && (
        <span className="relative flex h-2 w-2">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary-400 opacity-75" />
          <span className="relative inline-flex h-2 w-2 rounded-full bg-primary-500" />
        </span>
      )}
      {showDot && status !== 'auction_open' && (
        <span className="h-1.5 w-1.5 rounded-full bg-current opacity-70" />
      )}
      {label}
    </Badge>
  )
}

export default Badge
