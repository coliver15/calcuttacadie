import { cn } from '@/lib/utils'
import { formatCents, formatHandicap } from '@/lib/utils'
import { Badge } from '@/components/ui/Badge'
import type { Team, Flight } from '@/types/database'

interface TeamCardProps {
  team: Team
  flight?: Flight | null
  currentBidCents?: number
  showBid?: boolean
  size?: 'sm' | 'md' | 'lg'
  highlight?: boolean
  className?: string
}

const auctionStatusVariant = {
  pending: 'slate',
  active: 'success',
  sold: 'info',
  passed: 'default',
} as const

const auctionStatusLabel = {
  pending: 'Pending',
  active: 'Live',
  sold: 'Sold',
  passed: 'Passed',
}

export default function TeamCard({
  team,
  flight,
  currentBidCents,
  showBid = false,
  size = 'md',
  highlight = false,
  className,
}: TeamCardProps) {
  const isLg = size === 'lg'
  const isSm = size === 'sm'

  return (
    <div
      className={cn(
        'rounded-xl border transition-all duration-200',
        highlight
          ? 'bg-primary-900/20 border-primary-600/60 shadow-lg shadow-primary-900/20'
          : 'bg-slate-900 border-slate-700',
        isLg ? 'p-6' : isSm ? 'p-3' : 'p-5',
        className
      )}
    >
      {/* Header: Flight + Status */}
      <div className="flex items-center justify-between gap-2 mb-3">
        <div className="flex items-center gap-2">
          {flight && (
            <Badge variant="slate" className="text-xs">
              {flight.name}
            </Badge>
          )}
          <Badge variant={auctionStatusVariant[team.auction_status]}>
            {auctionStatusLabel[team.auction_status]}
          </Badge>
        </div>
        {team.auction_order !== null && (
          <span className="text-xs text-slate-500 font-mono">
            #{team.auction_order}
          </span>
        )}
      </div>

      {/* Player names */}
      <div className={cn('space-y-1', isLg ? 'mb-4' : 'mb-3')}>
        <div className="flex items-baseline justify-between gap-2">
          <span
            className={cn(
              'font-semibold text-white leading-tight',
              isLg ? 'text-2xl' : isSm ? 'text-sm' : 'text-lg'
            )}
          >
            {team.player1_name}
          </span>
          {team.player1_handicap_index !== null && (
            <span className="text-sm text-slate-400 font-mono flex-shrink-0">
              {formatHandicap(team.player1_handicap_index)}
            </span>
          )}
        </div>
        <div className="flex items-baseline justify-between gap-2">
          <span
            className={cn(
              'font-semibold text-white leading-tight',
              isLg ? 'text-2xl' : isSm ? 'text-sm' : 'text-lg'
            )}
          >
            {team.player2_name}
          </span>
          {team.player2_handicap_index !== null && (
            <span className="text-sm text-slate-400 font-mono flex-shrink-0">
              {formatHandicap(team.player2_handicap_index)}
            </span>
          )}
        </div>
      </div>

      {/* Bid info */}
      {showBid && (
        <div className="border-t border-slate-700/60 pt-3">
          {team.auction_status === 'sold' && team.final_sale_price_cents !== null ? (
            <div className="flex items-center justify-between">
              <span className="text-xs text-slate-400 uppercase tracking-wider">
                Sold for
              </span>
              <span className="font-bold text-primary-300 tabular-nums">
                {formatCents(team.final_sale_price_cents)}
              </span>
            </div>
          ) : team.auction_status === 'active' && currentBidCents !== undefined ? (
            <div className="flex items-center justify-between">
              <span className="text-xs text-slate-400 uppercase tracking-wider">
                Current Bid
              </span>
              <span className="font-bold text-yellow-300 tabular-nums text-lg">
                {formatCents(currentBidCents)}
              </span>
            </div>
          ) : null}
        </div>
      )}

      {/* Final place */}
      {team.final_place !== null && (
        <div className="border-t border-slate-700/60 pt-3 flex items-center justify-between">
          <span className="text-xs text-slate-400 uppercase tracking-wider">
            Finished
          </span>
          <span className="font-bold text-purple-300">
            {team.final_place === 1
              ? '1st Place'
              : team.final_place === 2
              ? '2nd Place'
              : team.final_place === 3
              ? '3rd Place'
              : `${team.final_place}th Place`}
          </span>
        </div>
      )}

      {/* Winnings */}
      {team.winnings_cents !== null && team.winnings_cents > 0 && (
        <div className="flex items-center justify-between">
          <span className="text-xs text-slate-400 uppercase tracking-wider">
            Winnings
          </span>
          <span className="font-bold text-green-300 tabular-nums">
            {formatCents(team.winnings_cents)}
          </span>
        </div>
      )}
    </div>
  )
}
