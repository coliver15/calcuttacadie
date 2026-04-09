# Calcutta App — Setup Guide

## Project Structure

```
calcutta-app/
├── supabase/
│   ├── config.toml
│   ├── migrations/
│   │   ├── 001_schema.sql         ← All tables, indexes
│   │   ├── 002_functions.sql      ← DB functions, triggers, auction engine
│   │   └── 003_rls.sql            ← Row Level Security policies
│   └── functions/
│       ├── _shared/cors.ts        ← Shared CORS + response helpers
│       ├── validate-access-code/  ← Public: validates team code → JWT
│       ├── place-bid/             ← Team: place a bid (real-time)
│       ├── manage-auction/        ← Admin: auction state machine
│       ├── handle-buyback/        ← Team/Admin: buyback flow
│       ├── manage-ownership-group/← Team: group ownership invites
│       └── stripe-webhook/        ← Stripe payment events
├── admin-portal/                  ← Next.js 14 admin web app
└── ios-app/                       ← SwiftUI iOS app (coming next)
```

---

## 1. Supabase Setup

### Create a project
1. Go to [supabase.com](https://supabase.com) → New Project
2. Note your **Project URL**, **Anon Key**, **Service Role Key**, and **JWT Secret**

### Install Supabase CLI
```bash
brew install supabase/tap/supabase
supabase login
```

### Link project and run migrations
```bash
cd calcutta-app
supabase link --project-ref YOUR_PROJECT_REF
supabase db push
```

Or run migrations manually in the Supabase SQL Editor in this order:
1. `supabase/migrations/001_schema.sql`
2. `supabase/migrations/002_functions.sql`
3. `supabase/migrations/003_rls.sql`

### Deploy Edge Functions
```bash
supabase functions deploy validate-access-code
supabase functions deploy place-bid
supabase functions deploy manage-auction
supabase functions deploy handle-buyback
supabase functions deploy manage-ownership-group
supabase functions deploy stripe-webhook
```

### Set Edge Function secrets
```bash
supabase secrets set STRIPE_SECRET_KEY=sk_live_...
supabase secrets set STRIPE_WEBHOOK_SECRET=whsec_...
```

### Configure Realtime
In the Supabase dashboard → Realtime → enable Broadcast for the `public` schema.
Channels follow the pattern `auction:{tournament_id}` — no additional config needed.

---

## 2. Stripe Setup

### Create products
In the Stripe dashboard, create two products:

| Product | Price | metadata |
|---|---|---|
| Single Tournament | $300 (one-time) | `purchase_type=single` |
| 5-Tournament Package | $1,000 (one-time) | `purchase_type=package` |

### Webhook
1. Stripe Dashboard → Webhooks → Add endpoint
2. URL: `https://YOUR_PROJECT_REF.functions.supabase.co/stripe-webhook`
3. Events to listen for:
   - `checkout.session.completed`
   - `charge.refunded`
4. Copy the signing secret → set as `STRIPE_WEBHOOK_SECRET`

### Checkout Session metadata
When creating a Stripe Checkout Session from the admin portal, include:
```json
{
  "metadata": {
    "admin_id": "uuid-of-the-admin",
    "purchase_type": "single"
  }
}
```

---

## 3. Admin Portal Setup

```bash
cd admin-portal
cp .env.local.example .env.local
# Fill in values (see below)
npm install
npm run dev
```

### Environment variables
```env
NEXT_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_live_...
STRIPE_SECRET_KEY=sk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...
NEXT_PUBLIC_APP_URL=https://yourdomain.com
```

### Deploy to Vercel
```bash
vercel --prod
```
Set the same environment variables in Vercel → Project Settings → Environment Variables.

---

## 4. Realtime Channel Events Reference

All clients subscribe to: `auction:{tournament_id}`

| Event | Direction | Payload |
|---|---|---|
| `auction:started` | Server → All | `{ tournament_id }` |
| `auction:team_started` | Server → All | `{ session_id, team_id, team, opening_bid_cents, timer_started_at, timer_duration_seconds }` |
| `bid:placed` | Server → All | `{ session_id, bidder_team_id, amount_cents, extended, timer_started_at, timer_duration_seconds }` |
| `bid:placed_extended` | Server → All | Same as above + extended=true |
| `auction:team_sold` | Server → All | `{ session_id, team_id, sale_price_cents, winning_bidder_team_id }` |
| `auction:team_passed` | Server → All | `{ session_id, team_id }` |
| `auction:completed` | Server → All | `{ tournament_id }` |
| `buyback:available` | Server → All | `{ session_id, team_id, sale_price_cents, buyback_amount_cents }` |
| `buyback:requested` | Server → All | `{ buyback_request_id, session_id, requesting_team_id, amount_cents }` |
| `buyback:confirmed` | Server → All | `{ buyback_request_id, session_id }` |
| `buyback:declined` | Server → All | `{ buyback_request_id, session_id }` |
| `group:invite_received` | Server → All | `{ invite_id, session_id, inviting_team_id, invited_team_id, percentage_offered }` |
| `group:invite_accepted` | Server → All | `{ invite_id, session_id, accepted_team_id, percentage_accepted }` |
| `group:invite_declined` | Server → All | `{ invite_id, session_id }` |

### Timer computation (client-side)
```typescript
// On every animation frame or 100ms interval:
const remaining = session.timer_duration_seconds - 
  (Date.now() / 1000 - new Date(session.timer_started_at).getTime() / 1000)

// remaining <= 0 means timer has expired
// Admin client calls close_team_session when remaining <= 0
```

---

## 5. Access Code Flow

```
Team opens app
  → Enters 6-char code
  → POST /functions/v1/validate-access-code { access_code }
  → Receives JWT with claims: { sub: team_id, team_id, tournament_id, user_role: 'team_guest' }
  → Client stores JWT, uses as Authorization header for all subsequent calls
  → Subscribes to Supabase Realtime channel auction:{tournament_id}
```

---

## 6. Auction Admin Flow

```
1. Admin creates tournament (status: draft)
2. Admin pays via Stripe (status: setup)
3. Admin adds teams, flights, payout tiers (status: setup → ready)
4. Admin clicks "Start Auction"
   → POST manage-auction { action: 'start_tournament_auction', tournament_id }
   → Tournament status: auction_live
   → Team order randomized (or manual)
5. For each team:
   a. Admin sets opening bid
   b. Admin clicks "Start Bidding"
      → POST manage-auction { action: 'start_team_session', session_id, opening_bid_cents }
      → Timer starts (30s default)
   c. Teams bid via app → POST place-bid { session_id, amount_cents }
   d. Timer expires → Admin clicks "Close & Next"
      → POST manage-auction { action: 'close_team_session', session_id }
      → POST manage-auction { action: 'next_team', tournament_id }
   e. If sold: sold team sees buyback prompt
6. All teams processed → auction_complete
7. After tournament: Admin enters placements
   → Updates teams.final_place per flight
   → Calls calculate_flight_winnings(flight_id) per flight
   → Tournament status: complete
```

---

## 7. Pricing

| Product | Price | Stripe Product ID |
|---|---|---|
| Single Tournament | $300 | Set in env: `STRIPE_SINGLE_PRICE_ID` |
| 5-Tournament Package | $1,000 | Set in env: `STRIPE_PACKAGE_PRICE_ID` |

Admin pays before tournament setup is unlocked. Package allows 5 tournament creations; `tournaments_remaining` decrements on each new tournament.
