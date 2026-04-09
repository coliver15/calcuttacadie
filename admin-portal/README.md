# Calcutta Admin Portal

A Next.js 14 (App Router) admin portal for running golf Calcutta auctions. Built with TypeScript, Tailwind CSS, Supabase, and Stripe.

---

## Stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 14 (App Router) |
| Language | TypeScript |
| Styling | Tailwind CSS v3 |
| Auth & Database | Supabase (`@supabase/supabase-js`, `@supabase/ssr`) |
| Realtime | Supabase Realtime (Broadcast channels) |
| Payments | Stripe Checkout (`stripe`, `@stripe/stripe-js`) |
| UI Components | Custom shadcn-style components (no CLI required) |

---

## Quick Start

### 1. Install dependencies

```bash
npm install
# or
yarn install
# or
pnpm install
```

### 2. Configure environment variables

Copy `.env.local.example` to `.env.local` and fill in the values:

```bash
cp .env.local.example .env.local
```

Required variables:

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# Stripe
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_...
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...

# App
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

### 3. Set up Supabase database

Run the following SQL in your Supabase SQL editor to create the required tables:

```sql
-- Admin profiles (extends auth.users)
create table admin_profiles (
  id uuid references auth.users(id) primary key,
  email text not null,
  full_name text,
  created_at timestamptz default now()
);

-- Tournaments
create table tournaments (
  id uuid primary key default gen_random_uuid(),
  admin_id uuid references auth.users(id) not null,
  name text not null,
  club_name text not null,
  club_location text,
  tournament_date date not null,
  status text not null default 'draft',
  timer_duration_seconds int not null default 120,
  timer_extension_seconds int not null default 30,
  timer_extension_threshold_seconds int not null default 15,
  min_bid_increment_cents int not null default 5000,
  auction_order_type text not null default 'random',
  current_auction_session_id uuid,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Tournament admins (owner + co-admins)
create table tournament_admins (
  id uuid primary key default gen_random_uuid(),
  tournament_id uuid references tournaments(id) on delete cascade,
  admin_id uuid references auth.users(id),
  role text not null default 'co_admin',
  created_at timestamptz default now(),
  unique(tournament_id, admin_id)
);

-- Flights
create table flights (
  id uuid primary key default gen_random_uuid(),
  tournament_id uuid references tournaments(id) on delete cascade,
  name text not null,
  display_order int not null default 1,
  created_at timestamptz default now()
);

-- Flight payout tiers
create table flight_payout_tiers (
  id uuid primary key default gen_random_uuid(),
  flight_id uuid references flights(id) on delete cascade,
  place int not null,
  percentage numeric(5,2) not null,
  unique(flight_id, place)
);

-- Teams
create table teams (
  id uuid primary key default gen_random_uuid(),
  tournament_id uuid references tournaments(id) on delete cascade,
  flight_id uuid references flights(id) on delete set null,
  player1_name text not null,
  player2_name text not null,
  player1_handicap_index numeric(4,1),
  player2_handicap_index numeric(4,1),
  access_code text not null,
  auction_order int,
  auction_status text not null default 'pending',
  final_sale_price_cents int,
  final_place int,
  winnings_cents int,
  created_at timestamptz default now()
);

-- Auction sessions
create table auction_sessions (
  id uuid primary key default gen_random_uuid(),
  tournament_id uuid references tournaments(id) on delete cascade,
  team_id uuid references teams(id) on delete cascade,
  status text not null default 'pending',
  opening_bid_cents int not null,
  current_bid_cents int not null,
  winning_bidder_team_id uuid references teams(id),
  timer_started_at timestamptz,
  timer_duration_seconds int not null,
  extension_count int not null default 0,
  sold_at timestamptz,
  created_at timestamptz default now()
);

-- Add FK from tournaments to auction_sessions
alter table tournaments
  add constraint tournaments_current_auction_session_id_fkey
  foreign key (current_auction_session_id) references auction_sessions(id);

-- Bids
create table bids (
  id uuid primary key default gen_random_uuid(),
  auction_session_id uuid references auction_sessions(id) on delete cascade,
  bidder_team_id uuid references teams(id),
  amount_cents int not null,
  is_winning boolean not null default false,
  created_at timestamptz default now()
);

-- Ownerships
create table ownerships (
  id uuid primary key default gen_random_uuid(),
  auction_session_id uuid references auction_sessions(id),
  team_id uuid references teams(id),
  owner_team_id uuid references teams(id),
  ownership_type text not null default 'full',
  ownership_percentage numeric(5,2) not null default 100,
  amount_paid_cents int not null,
  payment_confirmed boolean not null default false,
  payment_confirmed_at timestamptz,
  created_at timestamptz default now()
);

-- Tournament purchases
create table tournament_purchases (
  id uuid primary key default gen_random_uuid(),
  admin_id uuid references auth.users(id),
  purchase_type text not null,
  tournaments_total int not null,
  tournaments_remaining int not null,
  amount_paid_cents int not null,
  status text not null default 'pending',
  stripe_payment_intent_id text,
  stripe_session_id text,
  created_at timestamptz default now()
);

-- Row Level Security
alter table tournaments enable row level security;
alter table tournament_admins enable row level security;
alter table flights enable row level security;
alter table flight_payout_tiers enable row level security;
alter table teams enable row level security;
alter table auction_sessions enable row level security;
alter table bids enable row level security;
alter table ownerships enable row level security;
alter table tournament_purchases enable row level security;

-- Policies: admins can read/write their tournaments
create policy "Admins can manage own tournaments"
  on tournaments for all using (admin_id = auth.uid());

create policy "Tournament admins can read tournaments"
  on tournaments for select using (
    exists (
      select 1 from tournament_admins
      where tournament_id = tournaments.id
      and admin_id = auth.uid()
    )
  );

-- Anyone can read teams (for bidder app access via access_code)
create policy "Public can read teams"
  on teams for select using (true);

create policy "Tournament admins can manage teams"
  on teams for all using (
    exists (
      select 1 from tournament_admins ta
      join tournaments t on t.id = ta.tournament_id
      where t.id = teams.tournament_id
      and ta.admin_id = auth.uid()
    )
  );

-- Similar policies for flights, sessions, bids, ownerships
-- (add based on your security requirements)
```

### 4. Configure Stripe webhook

In your Stripe dashboard, create a webhook endpoint pointing to:
```
https://your-domain.com/api/billing/webhook
```

Listen for the event: `checkout.session.completed`

For local development, use the Stripe CLI:
```bash
stripe listen --forward-to localhost:3000/api/billing/webhook
```

### 5. Run the development server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to view the app.

---

## Project Structure

```
admin-portal/
├── app/
│   ├── (admin)/                    # Authenticated admin routes
│   │   ├── layout.tsx              # Admin shell layout with nav
│   │   ├── dashboard/              # Tournament list
│   │   ├── billing/                # Purchase credits
│   │   └── tournaments/
│   │       ├── new/                # Create tournament
│   │       └── [id]/
│   │           ├── page.tsx        # Tournament hub
│   │           ├── teams/          # Manage teams
│   │           ├── flights/        # Manage flights & payouts
│   │           ├── auction/        # Live auction control panel
│   │           └── results/        # Enter final placements
│   ├── auth/
│   │   ├── login/                  # Admin login
│   │   └── signup/                 # Admin registration
│   ├── api/
│   │   └── billing/
│   │       ├── checkout/           # POST: create Stripe session
│   │       └── webhook/            # POST: handle Stripe events
│   ├── display/
│   │   └── [id]/                   # TV display mode (public, read-only)
│   ├── layout.tsx                  # Root layout
│   ├── page.tsx                    # Marketing landing page
│   └── globals.css                 # Global styles
├── components/
│   ├── ui/
│   │   ├── Button.tsx
│   │   ├── Input.tsx               # Input, Textarea, Select
│   │   ├── Card.tsx
│   │   ├── Badge.tsx               # TournamentStatusBadge included
│   │   └── Modal.tsx
│   ├── auction/
│   │   ├── AuctionTimer.tsx        # Countdown timer (client)
│   │   ├── BidFeed.tsx             # Scrolling bid list
│   │   ├── AuctionControls.tsx     # Admin start/close controls
│   │   └── TeamCard.tsx            # Team display card
│   ├── teams/
│   │   ├── TeamTable.tsx           # Sortable team table
│   │   └── AddTeamForm.tsx         # Add team form
│   └── layout/
│       └── AdminNav.tsx            # Sidebar + mobile nav
├── lib/
│   ├── supabase/
│   │   ├── client.ts               # Browser Supabase client
│   │   ├── server.ts               # Server Supabase client
│   │   └── middleware.ts           # Session refresh helper
│   ├── stripe.ts                   # Stripe client + checkout helpers
│   └── utils.ts                    # Shared utilities (cn, formatCents, etc.)
├── types/
│   └── database.ts                 # TypeScript types for all DB tables
├── middleware.ts                    # Route protection + session refresh
└── README.md
```

---

## Routes

| Route | Description | Auth |
|-------|-------------|------|
| `/` | Marketing landing page | Public |
| `/auth/login` | Admin sign in | Public (redirects if authed) |
| `/auth/signup` | Admin registration | Public (redirects if authed) |
| `/dashboard` | Tournament list | Required |
| `/billing` | Purchase credits via Stripe | Required |
| `/tournaments/new` | Create tournament (needs credit) | Required |
| `/tournaments/[id]` | Tournament hub | Required |
| `/tournaments/[id]/teams` | Manage teams | Required |
| `/tournaments/[id]/flights` | Manage flights & payout tiers | Required |
| `/tournaments/[id]/auction` | Live auction control panel | Required |
| `/tournaments/[id]/results` | Enter placements, confirm payments | Required |
| `/display/[id]` | TV display mode (full-screen) | Public |

---

## Realtime Architecture

The auction uses Supabase Realtime **Broadcast channels** on channel `auction:{tournamentId}`.

### Events

| Event | Payload |
|-------|---------|
| `auction:team_started` | `{ auction_session, team }` |
| `bid:placed` | `{ bid, current_bid_cents, winning_bidder_team_id, timer_started_at, timer_duration_seconds, extension_count }` |
| `bid:placed_extended` | Same as `bid:placed` |
| `auction:team_sold` | `{ auction_session, team, winning_bidder_team_id, final_amount_cents }` |
| `auction:team_passed` | `{ auction_session, team }` |
| `auction:completed` | `{ tournament_id }` |

The **display page** (`/display/[id]`) subscribes to this channel and renders a read-only, full-screen view suitable for projectors and TVs.

---

## Timer Logic

The countdown timer is computed entirely client-side:

```ts
remaining = timer_duration_seconds - Math.floor((Date.now() - new Date(timer_started_at).getTime()) / 1000)
```

When a bid arrives within `timer_extension_threshold_seconds` of expiry, the server resets `timer_started_at` to `now()` and adds `timer_extension_seconds` to the new `timer_duration_seconds`, then broadcasts the updated values. The client re-renders the timer from the new values.

---

## Color Scheme

| Token | Value | Usage |
|-------|-------|-------|
| Primary | `#16a34a` (green-600) | CTAs, active states, golf aesthetic |
| Background | `#020617` (slate-950) | Page background |
| Surface | `#0f172a` (slate-900) | Cards, panels |
| Surface Elevated | `#1e293b` (slate-800) | Hover states |
| Border | `#334155` (slate-700) | All borders |
| Text | `#f1f5f9` (slate-100) | Body text |

---

## Development Notes

- **No Stripe CLI install needed** during development for the billing flow — just configure `STRIPE_WEBHOOK_SECRET` and use `stripe listen`.
- The bidder-facing app (for teams to place bids during the auction) is a **separate application** not included here. Teams authenticate using their `access_code` and connect to the same Supabase Realtime channel.
- Co-admin invitation UI is scaffolded but the full invite flow requires sending email invitations — implement via Supabase Edge Functions or a transactional email service.
- For production, add RLS policies for all tables and restrict the service role key to server-side API routes only.
