import { createClient } from '@/lib/supabase/server'
import { formatDate, formatCents } from '@/lib/utils'
import BillingClient from './BillingClient'
import type { TournamentPurchase } from '@/types/database'
import type { Metadata } from 'next'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export const metadata: Metadata = { title: 'Billing' }

export default async function BillingPage() {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const { data: purchases } = await supabase
    .from('tournament_purchases')
    .select('*')
    .eq('admin_id', user!.id)
    .order('created_at', { ascending: false })

  const purchaseList = (purchases as TournamentPurchase[] | null) ?? []

  const activeCredits = purchaseList
    .filter((p) => p.status === 'completed' && p.tournaments_remaining > 0)
    .reduce((sum, p) => sum + p.tournaments_remaining, 0)

  return (
    <div className="px-4 sm:px-6 lg:px-8 py-8 max-w-4xl">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-white">Billing</h1>
        <p className="text-sm text-slate-400 mt-1">
          Purchase tournament access credits
        </p>
      </div>

      {/* Credits summary */}
      {activeCredits > 0 && (
        <div className="mb-8 rounded-xl border border-primary-800/50 bg-primary-950/30 px-5 py-4 flex items-center gap-4">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary-900 text-primary-400 flex-shrink-0">
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
              <path d="M10 2l2 6h6l-5 3.5L15 18l-5-3.5L5 18l2-6.5L2 8h6z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
          <div>
            <p className="font-semibold text-primary-300">
              {activeCredits} active tournament credit{activeCredits !== 1 ? 's' : ''}
            </p>
            <p className="text-xs text-primary-400/70">
              Each credit lets you create and run one Calcutta tournament
            </p>
          </div>
        </div>
      )}

      {/* BillingClient handles the purchase interaction */}
      <BillingClient />

      {/* Purchase history */}
      {purchaseList.length > 0 && (
        <div className="mt-12">
          <h2 className="text-lg font-semibold text-white mb-4">Purchase History</h2>
          <div className="rounded-xl border border-slate-700 overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-slate-800/80 border-b border-slate-700">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider">
                    Date
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider">
                    Package
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider">
                    Amount
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider">
                    Credits
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider">
                    Status
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {purchaseList.map((purchase) => (
                  <tr key={purchase.id} className="hover:bg-slate-800/30">
                    <td className="px-4 py-3 text-slate-300">
                      {formatDate(purchase.created_at)}
                    </td>
                    <td className="px-4 py-3 text-slate-300">
                      {purchase.purchase_type === 'single'
                        ? 'Single Tournament'
                        : '5-Tournament Pack'}
                    </td>
                    <td className="px-4 py-3 font-mono text-slate-300">
                      {formatCents(purchase.amount_paid_cents)}
                    </td>
                    <td className="px-4 py-3 text-slate-300">
                      <span className="text-white font-medium">
                        {purchase.tournaments_remaining}
                      </span>
                      <span className="text-slate-500">
                        {' '}/ {purchase.tournaments_total}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset ${
                          purchase.status === 'completed'
                            ? 'bg-primary-900/60 text-primary-300 ring-primary-700'
                            : purchase.status === 'pending'
                            ? 'bg-yellow-900/60 text-yellow-300 ring-yellow-700'
                            : 'bg-red-900/60 text-red-300 ring-red-700'
                        }`}
                      >
                        {purchase.status.charAt(0).toUpperCase() +
                          purchase.status.slice(1)}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
