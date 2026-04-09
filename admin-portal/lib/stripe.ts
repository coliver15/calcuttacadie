import Stripe from 'stripe'
import { loadStripe, type Stripe as StripeJS } from '@stripe/stripe-js'

// Server-side Stripe client
export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2023-10-16',
  typescript: true,
})

// Browser-side Stripe loader (singleton)
let stripePromise: Promise<StripeJS | null>

export function getStripe() {
  if (!stripePromise) {
    stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!)
  }
  return stripePromise
}

// Price configuration
export const STRIPE_PRICES = {
  single: {
    name: 'Single Tournament Access',
    description: 'Run one tournament on Calcutta',
    amount_cents: 30000, // $300
    tournaments: 1,
    type: 'single' as const,
  },
  five_pack: {
    name: 'Tournament 5-Pack',
    description: 'Run up to 5 tournaments — best value',
    amount_cents: 100000, // $1,000
    tournaments: 5,
    type: 'package' as const,
  },
}

export type PriceKey = keyof typeof STRIPE_PRICES

// Create a Stripe Checkout session for tournament credits
export async function createCheckoutSession({
  priceKey,
  adminId,
  email,
  successUrl,
  cancelUrl,
}: {
  priceKey: PriceKey
  adminId: string
  email: string
  successUrl: string
  cancelUrl: string
}): Promise<string> {
  const price = STRIPE_PRICES[priceKey]

  const session = await stripe.checkout.sessions.create({
    mode: 'payment',
    payment_method_types: ['card'],
    customer_email: email,
    line_items: [
      {
        price_data: {
          currency: 'usd',
          product_data: {
            name: price.name,
            description: price.description,
          },
          unit_amount: price.amount_cents,
        },
        quantity: 1,
      },
    ],
    metadata: {
      admin_id: adminId,
      purchase_type: price.type,
      tournaments_total: price.tournaments.toString(),
      amount_paid_cents: price.amount_cents.toString(),
    },
    success_url: successUrl,
    cancel_url: cancelUrl,
  })

  return session.url!
}

// Construct and verify a Stripe webhook event
export function constructWebhookEvent(
  payload: string | Buffer,
  signature: string
): Stripe.Event {
  return stripe.webhooks.constructEvent(
    payload,
    signature,
    process.env.STRIPE_WEBHOOK_SECRET!
  )
}

// Format cents to dollars string
export function formatCents(cents: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(cents / 100)
}
