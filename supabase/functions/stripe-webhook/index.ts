// stripe-webhook Edge Function
// Receives and verifies Stripe webhook events.
// verify_jwt = false in config.toml (Stripe signs its own payloads).
//
// Handled events:
//   checkout.session.completed  — activate tournament purchase
//   charge.refunded             — mark purchase refunded
//
// Set STRIPE_WEBHOOK_SECRET in Supabase secrets:
//   supabase secrets set STRIPE_WEBHOOK_SECRET=whsec_...

import Stripe from 'https://esm.sh/stripe@14.21.0?target=deno'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders, handleCors, jsonResponse, errorResponse } from '../_shared/cors.ts'

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY')!, {
  apiVersion: '2024-04-10',
  httpClient: Stripe.createFetchHttpClient(),
})

Deno.serve(async (req) => {
  // Stripe sends POST; OPTIONS won't be called, but handle it anyway
  const corsResponse = handleCors(req)
  if (corsResponse) return corsResponse

  const signature = req.headers.get('stripe-signature')
  if (!signature) return errorResponse('Missing stripe-signature', 400)

  const body = await req.text()

  let event: Stripe.Event
  try {
    event = await stripe.webhooks.constructEventAsync(
      body,
      signature,
      Deno.env.get('STRIPE_WEBHOOK_SECRET')!
    )
  } catch (err) {
    console.error('Stripe webhook signature verification failed:', err)
    return errorResponse('Invalid signature', 400)
  }

  const db = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  )

  try {
    switch (event.type) {

      // ── Payment completed — activate purchase ──────────────
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session

        const adminId      = session.metadata?.admin_id
        const purchaseType = session.metadata?.purchase_type as 'single' | 'package'

        if (!adminId || !purchaseType) {
          console.error('Missing metadata on checkout session:', session.id)
          break
        }

        const tournamentsTotal = purchaseType === 'package' ? 5 : 1

        const { error } = await db.from('tournament_purchases').insert({
          admin_id:                   adminId,
          stripe_checkout_session_id: session.id,
          stripe_payment_intent_id:   session.payment_intent as string,
          purchase_type:              purchaseType,
          tournaments_total:          tournamentsTotal,
          tournaments_remaining:      tournamentsTotal,
          amount_paid_cents:          session.amount_total ?? 0,
          status:                     'paid',
        })

        if (error) {
          console.error('Failed to create tournament purchase:', error)
          return errorResponse('DB insert failed', 500)
        }

        console.log(`Purchase activated for admin ${adminId}: ${purchaseType} (${tournamentsTotal} tournaments)`)
        break
      }

      // ── Refund issued ──────────────────────────────────────
      case 'charge.refunded': {
        const charge = event.data.object as Stripe.Charge
        const paymentIntentId = charge.payment_intent as string

        if (paymentIntentId) {
          await db.from('tournament_purchases')
            .update({ status: 'refunded', updated_at: new Date().toISOString() })
            .eq('stripe_payment_intent_id', paymentIntentId)
        }
        break
      }

      default:
        console.log('Unhandled Stripe event type:', event.type)
    }
  } catch (err) {
    console.error('Webhook handler error:', err)
    return errorResponse('Webhook processing failed', 500)
  }

  return jsonResponse({ received: true })
})
