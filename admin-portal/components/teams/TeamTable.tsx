'use client'

import { useState, useMemo } from 'react'
import { cn } from '@/lib/utils'
import { formatCents, formatHandicap } from '@/lib/utils'
import { Badge } from '@/components/ui/Badge'
import Button from '@/components/ui/Button'
import type { Team, Flight } from '@/types/database'

type SortKey = 'auction_order' | 'player1_name' | 'flight' | 'auction_status' | 'final_sale_price_cents'
type SortDir = 'asc' | 'desc'

interface TeamTableProps {
  teams: Team[]
  flights: Flight[]
  onEditTeam?: (team: Team) => void
  onDeleteTeam?: (team: Team) => void
  showAccessCodes?: boolean
  readOnly?: boolean
}

const statusOrder = { active: 0, pending: 1, sold: 2, passed: 3 }

export default function TeamTable({
  teams,
  flights,
  onEditTeam,
  onDeleteTeam,
  showAccessCodes = true,
  readOnly = false,
}: TeamTableProps) {
  const [sortKey, setSortKey] = useState<SortKey>('auction_order')
  const [sortDir, setSortDir] = useState<SortDir>('asc')
  const [copiedCode, setCopiedCode] = useState<string | null>(null)

  const flightMap = useMemo(
    () => new Map(flights.map((f) => [f.id, f])),
    [flights]
  )

  function handleSort(key: SortKey) {
    if (key === sortKey) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortKey(key)
      setSortDir('asc')
    }
  }

  const sorted = useMemo(() => {
    return [...teams].sort((a, b) => {
      let compare = 0
      switch (sortKey) {
        case 'auction_order':
          compare = (a.auction_order ?? 9999) - (b.auction_order ?? 9999)
          break
        case 'player1_name':
          compare = a.player1_name.localeCompare(b.player1_name)
          break
        case 'flight': {
          const flightA = a.flight_id ? flightMap.get(a.flight_id)?.name ?? '' : ''
          const flightB = b.flight_id ? flightMap.get(b.flight_id)?.name ?? '' : ''
          compare = flightA.localeCompare(flightB)
          break
        }
        case 'auction_status':
          compare = statusOrder[a.auction_status] - statusOrder[b.auction_status]
          break
        case 'final_sale_price_cents':
          compare = (a.final_sale_price_cents ?? 0) - (b.final_sale_price_cents ?? 0)
          break
      }
      return sortDir === 'desc' ? -compare : compare
    })
  }, [teams, sortKey, sortDir, flightMap])

  async function copyCode(code: string) {
    await navigator.clipboard.writeText(code)
    setCopiedCode(code)
    setTimeout(() => setCopiedCode(null), 2000)
  }

  function SortIcon({ k }: { k: SortKey }) {
    if (sortKey !== k) return <span className="text-slate-600">⇅</span>
    return <span className="text-primary-400">{sortDir === 'asc' ? '↑' : '↓'}</span>
  }

  const thClass =
    'px-3 py-2.5 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider whitespace-nowrap cursor-pointer hover:text-slate-200 select-none'

  return (
    <div className="overflow-x-auto rounded-xl border border-slate-700">
      <table className="w-full text-sm">
        <thead className="bg-slate-800/80 border-b border-slate-700">
          <tr>
            <th
              className={thClass}
              onClick={() => handleSort('auction_order')}
            >
              # <SortIcon k="auction_order" />
            </th>
            <th
              className={thClass}
              onClick={() => handleSort('player1_name')}
            >
              Players <SortIcon k="player1_name" />
            </th>
            <th
              className={thClass}
              onClick={() => handleSort('flight')}
            >
              Flight <SortIcon k="flight" />
            </th>
            <th className="px-3 py-2.5 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider">
              Handicaps
            </th>
            {showAccessCodes && (
              <th className="px-3 py-2.5 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider">
                Access Code
              </th>
            )}
            <th
              className={thClass}
              onClick={() => handleSort('auction_status')}
            >
              Status <SortIcon k="auction_status" />
            </th>
            <th
              className={thClass}
              onClick={() => handleSort('final_sale_price_cents')}
            >
              Sale Price <SortIcon k="final_sale_price_cents" />
            </th>
            {!readOnly && <th className="px-3 py-2.5 text-right text-xs font-semibold text-slate-400 uppercase tracking-wider">Actions</th>}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-800">
          {sorted.length === 0 ? (
            <tr>
              <td
                colSpan={readOnly ? 6 : 7}
                className="px-4 py-8 text-center text-slate-500"
              >
                No teams added yet
              </td>
            </tr>
          ) : (
            sorted.map((team) => {
              const flight = team.flight_id ? flightMap.get(team.flight_id) : null

              return (
                <tr
                  key={team.id}
                  className={cn(
                    'group transition-colors',
                    team.auction_status === 'active'
                      ? 'bg-primary-900/10'
                      : 'hover:bg-slate-800/40'
                  )}
                >
                  {/* Order */}
                  <td className="px-3 py-3 text-slate-500 font-mono text-xs">
                    {team.auction_order ?? '—'}
                  </td>

                  {/* Players */}
                  <td className="px-3 py-3">
                    <div className="font-medium text-white">{team.player1_name}</div>
                    <div className="text-slate-400">{team.player2_name}</div>
                  </td>

                  {/* Flight */}
                  <td className="px-3 py-3">
                    {flight ? (
                      <Badge variant="slate">{flight.name}</Badge>
                    ) : (
                      <span className="text-slate-600 text-xs">—</span>
                    )}
                  </td>

                  {/* Handicaps */}
                  <td className="px-3 py-3 text-slate-400 font-mono text-xs">
                    {formatHandicap(team.player1_handicap_index)} /{' '}
                    {formatHandicap(team.player2_handicap_index)}
                  </td>

                  {/* Access Code */}
                  {showAccessCodes && (
                    <td className="px-3 py-3">
                      <div className="flex items-center gap-2">
                        <code className="font-mono text-xs bg-slate-800 rounded px-2 py-1 text-slate-300 tracking-widest">
                          {team.access_code}
                        </code>
                        <button
                          onClick={() => copyCode(team.access_code)}
                          className="text-slate-500 hover:text-slate-200 transition-colors text-xs"
                          title="Copy access code"
                          aria-label="Copy access code"
                        >
                          {copiedCode === team.access_code ? '✓' : '⧉'}
                        </button>
                      </div>
                    </td>
                  )}

                  {/* Status */}
                  <td className="px-3 py-3">
                    <Badge
                      variant={
                        team.auction_status === 'active'
                          ? 'success'
                          : team.auction_status === 'sold'
                          ? 'info'
                          : team.auction_status === 'passed'
                          ? 'default'
                          : 'slate'
                      }
                    >
                      {team.auction_status === 'active' && (
                        <span className="relative flex h-1.5 w-1.5">
                          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary-400 opacity-75" />
                          <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-primary-500" />
                        </span>
                      )}
                      {team.auction_status.charAt(0).toUpperCase() +
                        team.auction_status.slice(1)}
                    </Badge>
                  </td>

                  {/* Sale Price */}
                  <td className="px-3 py-3 font-mono text-sm">
                    {team.final_sale_price_cents !== null ? (
                      <span className="text-primary-300">
                        {formatCents(team.final_sale_price_cents)}
                      </span>
                    ) : (
                      <span className="text-slate-600">—</span>
                    )}
                  </td>

                  {/* Actions */}
                  {!readOnly && (
                    <td className="px-3 py-3 text-right">
                      <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        {onEditTeam && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => onEditTeam(team)}
                          >
                            Edit
                          </Button>
                        )}
                        {onDeleteTeam && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => onDeleteTeam(team)}
                            className="text-red-400 hover:text-red-300 hover:bg-red-900/20"
                          >
                            Delete
                          </Button>
                        )}
                      </div>
                    </td>
                  )}
                </tr>
              )
            })
          )}
        </tbody>
      </table>
    </div>
  )
}
