import { NextRequest, NextResponse } from 'next/server'
import { constructWebhookEvent } from '@/lib/stripe'
import { createAdminClient } from '@/lib/supabase/server'
import Stripe from 'stripe'

export const runtime = 'nodejs'

export async function POST(request: NextRequest) {
  const body = await request.text()
  const signature = request.headers.get('stripe-signature')

  if (!signature) {
    return NextResponse.json({ error: 'Missing stripe signature' }, { status: 400 })
  }

  let event: Stripe.Event
  try {
    event = constructWebhookEvent(body, signature)
  } catch (err) {
    console.error('Webhook signature verification failed:', err)
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 })
  }

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object as Stripe.Checkout.Session

    const adminId = session.metadata?.admin_id
    const purchaseType = session.metadata?.purchase_type
    const tournamentsTotal = parseInt(session.metadata?.tournaments_total ?? '1', 10)
    const amountPaidCents = parseInt(session.metadata?.amount_paid_cents ?? '0', 10)

    if (!adminId || !purchaseType) {
      console.error('Missing metadata in checkout session:', session.id)
      return NextResponse.json({ received: true })
    }

    const supabase = createAdminClient()
    const { error } = await supabase.from('tournament_purchases').insert({
      admin_id: adminId,
      purchase_type: purchaseType,
      tournaments_total: tournamentsTotal,
      tournaments_remaining: tournamentsTotal,
      amount_paid_cents: amountPaidCents,
      status: 'completed',
      stripe_payment_intent_id: session.payment_intent as string | null,
      stripe_session_id: session.id,
    })

    if (error) {
      console.error('Failed to insert purchase record:', error)
      return NextResponse.json({ error: 'Database error' }, { status: 500 })
    }
  }

  return NextResponse.json({ received: true })
}
