'use client'

import { useState } from 'react'
import Button from '@/components/ui/Button'
import type { PriceKey } from '@/lib/stripe'

const PRICE_OPTIONS: {
  key: PriceKey
  name: string
  description: string
  price: string
  pricePerTournament: string
  tournaments: number
  features: string[]
  highlighted?: boolean
}[] = [
  {
    key: 'single',
    name: 'Single Tournament',
    description: 'Run one Calcutta auction',
    price: '$300',
    pricePerTournament: '$300 / tournament',
    tournaments: 1,
    features: [
      'Full auction control panel',
      'Real-time bidding & timer',
      'TV display mode',
      'Up to 3 co-admins',
      'Payout calculations',
    ],
  },
  {
    key: 'five_pack',
    name: '5-Tournament Pack',
    description: 'Run up to 5 tournaments',
    price: '$1,000',
    pricePerTournament: '$200 / tournament',
    tournaments: 5,
    highlighted: true,
    features: [
      'Everything in Single',
      '5 tournament credits',
      'Credits never expire',
      'Priority support',
      'Save $500 vs single',
    ],
  },
]

export default function BillingClient() {
  const [loading, setLoading] = useState<PriceKey | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function handlePurchase(priceKey: PriceKey) {
    setError(null)
    setLoading(priceKey)

    try {
      const res = await fetch('/api/billing/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ priceKey }),
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Failed to create checkout session')
      }

      const { url } = await res.json()
      window.location.href = url
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong')
      setLoading(null)
    }
  }

  return (
    <div>
      {error && (
        <div className="mb-6 rounded-lg bg-red-900/30 border border-red-700/50 px-4 py-3 text-sm text-red-300">
          {error}
        </div>
      )}

      <div className="grid sm:grid-cols-2 gap-5">
        {PRICE_OPTIONS.map((option) => (
          <div
            key={option.key}
            className={`relative rounded-2xl border p-7 flex flex-col ${
              option.highlighted
                ? 'border-primary-700/60 bg-primary-950/30'
                : 'border-slate-700 bg-slate-900'
            }`}
          >
            {option.highlighted && (
              <div className="absolute -top-3 left-6">
                <span className="rounded-full bg-primary-600 px-3 py-1 text-xs font-bold text-white uppercase tracking-wide">
                  Best Value
                </span>
              </div>
            )}

            <div className="mb-5">
              <p
                className={`text-sm font-semibold uppercase tracking-wider mb-2 ${
                  option.highlighted ? 'text-primary-400' : 'text-slate-400'
                }`}
              >
                {option.name}
              </p>
              <div className="flex items-baseline gap-2">
                <span className="text-4xl font-bold text-white">
                  {option.price}
                </span>
              </div>
              <p
                className={`text-sm mt-1 ${
                  option.highlighted ? 'text-primary-400' : 'text-slate-500'
                }`}
              >
                {option.pricePerTournament}
              </p>
            </div>

            <ul className="space-y-2 flex-1 mb-6">
              {option.features.map((feature) => (
                <li
                  key={feature}
                  className="flex items-center gap-2.5 text-sm text-slate-300"
                >
                  <svg
                    width="15"
                    height="15"
                    viewBox="0 0 15 15"
                    fill="none"
                    className={option.highlighted ? 'text-primary-400' : 'text-primary-500'}
                    aria-hidden="true"
                  >
                    <path
                      d="M2 7.5l3.5 3.5 7.5-7"
                      stroke="currentColor"
                      strokeWidth="1.75"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                  {feature}
                </li>
              ))}
            </ul>

            <Button
              variant={option.highlighted ? 'primary' : 'outline'}
              size="lg"
              fullWidth
              onClick={() => handlePurchase(option.key)}
              loading={loading === option.key}
              disabled={loading !== null && loading !== option.key}
            >
              Purchase {option.name}
            </Button>
          </div>
        ))}
      </div>

      <p className="mt-5 text-xs text-slate-500 text-center">
        Secure checkout powered by Stripe. Credits do not expire.
      </p>
    </div>
  )
}
