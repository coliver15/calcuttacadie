-- ============================================
-- CALCUTTA APP — DATABASE SCHEMA
-- Platform: Supabase / PostgreSQL
-- ============================================

-- Enable required extensions
create extension if not exists "uuid-ossp";
create extension if not exists "pgcrypto";

-- ============================================
-- ADMIN PROFILES
-- Extends Supabase auth.users for tournament admins
-- ============================================
create table public.admin_profiles (
  id           uuid references auth.users(id) on delete cascade primary key,
  email        text not null,
  full_name    text,
  stripe_customer_id text unique,
  created_at   timestamptz default now(),
  updated_at   timestamptz default now()
);

-- ============================================
-- USER PROFILES
-- Optional registered accounts for bidding participants
-- Not required — teams can access via access_code alone
-- ============================================
create table public.user_profiles (
  id           uuid references auth.users(id) on delete cascade primary key,
  email        text not null,
  full_name    text,
  created_at   timestamptz default now(),
  updated_at   timestamptz default now()
);

-- ============================================
-- TOURNAMENT PURCHASES
-- Stripe purchase records that unlock tournament slots
-- purchase_type: 'single' ($300) or 'package' ($1,000 / 5 tournaments)
-- ============================================
create table public.tournament_purchases (
  id                          uuid primary key default uuid_generate_v4(),
  admin_id                    uuid references public.admin_profiles(id) not null,
  stripe_checkout_session_id  text unique,
  stripe_payment_intent_id    text,
  purchase_type               text not null check (purchase_type in ('single', 'package')),
  tournaments_total           integer not null check (tournaments_total in (1, 5)),
  tournaments_remaining       integer not null,
  amount_paid_cents           integer not null,
  status                      text not null default 'pending'
                                check (status in ('pending', 'paid', 'refunded')),
  created_at                  timestamptz default now(),
  updated_at                  timestamptz default now()
);

-- ============================================
-- TOURNAMENTS
-- Core tournament record + all auction configuration
-- ============================================
create table public.tournaments (
  id                                  uuid primary key default uuid_generate_v4(),
  name                                text not null,
  club_name                           text not null,
  club_location                       text,
  tournament_date                     date,
  created_by                          uuid references public.admin_profiles(id) not null,
  purchase_id                         uuid references public.tournament_purchases(id),

  -- Lifecycle status
  -- draft          → setup not complete, not paid
  -- setup          → paid, admin configuring teams/flights
  -- ready          → setup complete, auction not yet started
  -- auction_live   → auction currently running
  -- auction_complete → all teams sold/passed, results not yet entered
  -- results_pending → admin entering final placements
  -- complete       → results entered, winnings calculated
  status  text not null default 'draft' check (
    status in ('draft','setup','ready','auction_live','auction_complete','results_pending','complete')
  ),

  -- Auction settings (all customizable by admin)
  timer_duration_seconds              integer not null default 30,
  timer_extension_seconds             integer not null default 5,
  timer_extension_threshold_seconds   integer not null default 5,
  min_bid_increment_cents             integer not null default 2500,  -- $25.00
  auction_order_type                  text not null default 'random'
                                        check (auction_order_type in ('random', 'manual')),

  -- Pointer to the currently active auction session (null if not in auction)
  current_auction_session_id          uuid, -- FK added after auction_sessions table is created

  created_at  timestamptz default now(),
  updated_at  timestamptz default now()
);

-- ============================================
-- TOURNAMENT ADMINS
-- Up to 3 admin accounts per tournament
-- ============================================
create table public.tournament_admins (
  tournament_id  uuid references public.tournaments(id) on delete cascade,
  admin_id       uuid references public.admin_profiles(id) on delete cascade,
  role           text not null default 'co_admin' check (role in ('owner', 'co_admin')),
  created_at     timestamptz default now(),
  primary key (tournament_id, admin_id)
);

-- ============================================
-- FLIGHTS
-- Optional groupings within a tournament
-- e.g., "Championship Flight", "A Flight", "B Flight"
-- If no flights exist, all teams compete in one pool
-- ============================================
create table public.flights (
  id             uuid primary key default uuid_generate_v4(),
  tournament_id  uuid references public.tournaments(id) on delete cascade not null,
  name           text not null,
  display_order  integer not null default 0,
  created_at     timestamptz default now()
);

-- ============================================
-- FLIGHT PAYOUT TIERS
-- Admin configures what % of each flight's pool goes to 1st, 2nd, 3rd, etc.
-- Prize pool = sum of all winning bids for teams within the flight
-- ============================================
create table public.flight_payout_tiers (
  id          uuid primary key default uuid_generate_v4(),
  flight_id   uuid references public.flights(id) on delete cascade not null,
  place       integer not null check (place > 0),
  percentage  numeric(5, 2) not null check (percentage > 0 and percentage <= 100),
  unique (flight_id, place)
);

-- ============================================
-- PLAYERS
-- Persistent player records across tournaments for historical tracking
-- Linked to user_profiles if the player creates an app account
-- Admin can also create player records manually for historical association
-- ============================================
create table public.players (
  id          uuid primary key default uuid_generate_v4(),
  user_id     uuid references public.user_profiles(id) unique, -- null if no account yet
  full_name   text not null,
  email       text,
  created_at  timestamptz default now(),
  updated_at  timestamptz default now()
);

-- ============================================
-- TEAMS
-- A two-player team entered in a specific tournament by admin
-- access_code: 6-char random alphanumeric, globally unique, tournament-specific
-- player1_id / player2_id link to persistent player records for historical stats
-- ============================================
create table public.teams (
  id                    uuid primary key default uuid_generate_v4(),
  tournament_id         uuid references public.tournaments(id) on delete cascade not null,
  flight_id             uuid references public.flights(id),

  -- Persistent player links (for historical stats)
  player1_id            uuid references public.players(id),
  player2_id            uuid references public.players(id),

  -- Denormalized display names (always set by admin regardless of player records)
  player1_name          text not null,
  player2_name          text not null,
  player1_handicap_index  numeric(4, 1),
  player2_handicap_index  numeric(4, 1),

  -- Bidding portal access
  access_code           char(6) not null unique, -- random, globally unique

  -- Auction state for this team
  auction_order         integer, -- sequence in the auction (random or manual)
  auction_status        text not null default 'pending'
                          check (auction_status in ('pending', 'active', 'sold', 'passed')),
  final_sale_price_cents  integer, -- set when sold

  -- Tournament results (set by admin after play)
  final_place           integer check (final_place > 0), -- place within their flight
  winnings_cents        integer, -- computed from payout tiers and flight pool

  created_at  timestamptz default now(),
  updated_at  timestamptz default now()
);

-- ============================================
-- AUCTION SESSIONS
-- One record per team — the full lifecycle of auctioning that team
-- Server-authoritative: timer is tracked via timer_started_at + duration
-- Clients calculate remaining = timer_duration_seconds - (now - timer_started_at)
-- On bid within threshold, server updates timer_started_at to extend
-- ============================================
create table public.auction_sessions (
  id                        uuid primary key default uuid_generate_v4(),
  tournament_id             uuid references public.tournaments(id) not null,
  team_id                   uuid references public.teams(id) not null unique,

  status  text not null default 'pending' check (
    status in ('pending', 'active', 'sold', 'passed')
  ),

  opening_bid_cents         integer not null default 0,
  current_bid_cents         integer,
  winning_bidder_team_id    uuid references public.teams(id),

  -- Server-side timer management
  timer_started_at          timestamptz,
  timer_duration_seconds    integer not null, -- snapshot of tournament setting at start
  extension_count           integer not null default 0,

  sold_at                   timestamptz,
  created_at                timestamptz default now(),
  updated_at                timestamptz default now()
);

-- Add forward FK from tournaments back to auction_sessions
alter table public.tournaments
  add constraint fk_current_auction_session
  foreign key (current_auction_session_id)
  references public.auction_sessions(id);

-- ============================================
-- BIDS
-- Individual bids placed during an auction session
-- is_winning is set to false when a higher bid is placed
-- ============================================
create table public.bids (
  id                  uuid primary key default uuid_generate_v4(),
  auction_session_id  uuid references public.auction_sessions(id) not null,
  bidder_team_id      uuid references public.teams(id) not null,
  amount_cents        integer not null check (amount_cents > 0),
  is_winning          boolean not null default true,
  created_at          timestamptz default now()
);

-- ============================================
-- OWNERSHIPS
-- Who owns what percentage of each team post-auction
-- Multiple rows per team_id (buyer, buyback, group shares)
-- All rows for a given team_id must sum to 100%
-- ============================================
create table public.ownerships (
  id                    uuid primary key default uuid_generate_v4(),
  auction_session_id    uuid references public.auction_sessions(id) not null,
  team_id               uuid references public.teams(id) not null,  -- team that was purchased
  owner_team_id         uuid references public.teams(id) not null,  -- team that owns them

  ownership_type  text not null check (
    ownership_type in ('purchase', 'buyback', 'group_share')
  ),

  ownership_percentage  numeric(6, 3) not null
                          check (ownership_percentage > 0 and ownership_percentage <= 100),
  amount_paid_cents     integer,

  -- Payment confirmation (cash, off-platform)
  payment_confirmed       boolean not null default false,
  payment_confirmed_at    timestamptz,

  created_at  timestamptz default now(),
  updated_at  timestamptz default now()
);

-- ============================================
-- BUYBACK REQUESTS
-- Triggered immediately after a team's auction session closes (they were sold)
-- The sold team requests to buy 50% back from the winning bidder
-- winning_bidder_team_id confirms receipt of cash off-platform
-- Auto-reduces all ownership_group shares by 50% upon confirmation
-- ============================================
create table public.buyback_requests (
  id                    uuid primary key default uuid_generate_v4(),
  auction_session_id    uuid references public.auction_sessions(id) not null unique,
  requesting_team_id    uuid references public.teams(id) not null,
  amount_cents          integer not null,  -- 50% of final_sale_price

  status  text not null default 'pending' check (
    status in ('pending', 'confirmed', 'declined', 'expired')
  ),

  confirmed_by_team_id  uuid references public.teams(id), -- winning bidder who confirms
  confirmed_at          timestamptz,

  created_at  timestamptz default now(),
  updated_at  timestamptz default now()
);

-- ============================================
-- OWNERSHIP GROUP INVITES
-- After winning a team, the buyer can invite up to 3 other teams
-- to share ownership (max 4 owners total including buyer)
-- Upon buyback confirmation, all group shares are halved automatically
-- ============================================
create table public.ownership_group_invites (
  id                    uuid primary key default uuid_generate_v4(),
  primary_ownership_id  uuid references public.ownerships(id) not null,
  auction_session_id    uuid references public.auction_sessions(id) not null,
  invited_team_id       uuid references public.teams(id) not null,
  percentage_offered    numeric(6, 3) not null
                          check (percentage_offered > 0 and percentage_offered <= 100),

  status  text not null default 'pending' check (
    status in ('pending', 'accepted', 'declined')
  ),

  responded_at  timestamptz,
  created_at    timestamptz default now(),
  updated_at    timestamptz default now(),

  unique (auction_session_id, invited_team_id)
);

-- ============================================
-- INDEXES
-- ============================================
create index idx_tournaments_created_by           on public.tournaments(created_by);
create index idx_tournaments_status               on public.tournaments(status);
create index idx_teams_tournament_id              on public.teams(tournament_id);
create index idx_teams_flight_id                  on public.teams(flight_id);
create index idx_teams_access_code                on public.teams(access_code);
create index idx_teams_player1_id                 on public.teams(player1_id);
create index idx_teams_player2_id                 on public.teams(player2_id);
create index idx_auction_sessions_tournament_id   on public.auction_sessions(tournament_id);
create index idx_auction_sessions_status          on public.auction_sessions(status);
create index idx_bids_auction_session_id          on public.bids(auction_session_id);
create index idx_bids_bidder_team_id              on public.bids(bidder_team_id);
create index idx_ownerships_team_id               on public.ownerships(team_id);
create index idx_ownerships_owner_team_id         on public.ownerships(owner_team_id);
create index idx_ownerships_auction_session_id    on public.ownerships(auction_session_id);
create index idx_group_invites_invited_team       on public.ownership_group_invites(invited_team_id);
create index idx_purchases_admin_id               on public.tournament_purchases(admin_id);
create index idx_players_user_id                  on public.players(user_id);
