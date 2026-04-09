import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createCheckoutSession, STRIPE_PRICES, type PriceKey } from '@/lib/stripe'

export async function POST(request: NextRequest) {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let priceKey: PriceKey
  try {
    const body = await request.json()
    priceKey = body.priceKey
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }

  if (!priceKey || !STRIPE_PRICES[priceKey]) {
    return NextResponse.json({ error: 'Invalid price key' }, { status: 400 })
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'

  try {
    const url = await createCheckoutSession({
      priceKey,
      adminId: user.id,
      email: user.email!,
      successUrl: `${appUrl}/billing?success=true`,
      cancelUrl: `${appUrl}/billing`,
    })

    return NextResponse.json({ url })
  } catch (error) {
    console.error('Checkout session error:', error)
    return NextResponse.json(
      { error: 'Failed to create checkout session' },
      { status: 500 }
    )
  }
}
