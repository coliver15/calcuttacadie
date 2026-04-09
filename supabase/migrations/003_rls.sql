-- ============================================
-- CALCUTTA APP — ROW LEVEL SECURITY POLICIES
-- Migration 003
--
-- AUTH MODEL:
--   Admins:      Supabase auth users with a row in admin_profiles
--   App Users:   Supabase auth users with a row in user_profiles (optional)
--   Team Guests: Custom JWT from validate-access-code Edge Function
--                Claims: { sub: team_id, team_id, tournament_id, user_role: 'team_guest' }
--                auth.uid() returns team_id for guests
--                jwt_team_id() returns team_id
--                jwt_tournament_id() returns tournament_id
-- ============================================

-- Enable RLS on all public tables
alter table public.admin_profiles             enable row level security;
alter table public.user_profiles              enable row level security;
alter table public.tournament_purchases       enable row level security;
alter table public.tournaments                enable row level security;
alter table public.tournament_admins          enable row level security;
alter table public.flights                    enable row level security;
alter table public.flight_payout_tiers        enable row level security;
alter table public.players                    enable row level security;
alter table public.teams                      enable row level security;
alter table public.auction_sessions           enable row level security;
alter table public.bids                       enable row level security;
alter table public.ownerships                 enable row level security;
alter table public.buyback_requests           enable row level security;
alter table public.ownership_group_invites    enable row level security;

-- ============================================
-- ADMIN PROFILES
-- ============================================
create policy "Admins can read own profile"
  on public.admin_profiles for select
  using (id = auth.uid());

create policy "Admins can update own profile"
  on public.admin_profiles for update
  using (id = auth.uid());

-- Supabase auth trigger creates this row; handled via service role in Edge Function

-- ============================================
-- USER PROFILES
-- ============================================
create policy "Users can read own profile"
  on public.user_profiles for select
  using (id = auth.uid());

create policy "Users can update own profile"
  on public.user_profiles for update
  using (id = auth.uid());

-- ============================================
-- TOURNAMENT PURCHASES
-- ============================================
create policy "Admins can read own purchases"
  on public.tournament_purchases for select
  using (admin_id = auth.uid());

-- Inserts handled via service role in stripe-webhook Edge Function

-- ============================================
-- TOURNAMENTS
-- ============================================
create policy "Admins can read tournaments they manage"
  on public.tournaments for select
  using (public.is_tournament_admin(id));

create policy "Team guests can read their tournament"
  on public.tournaments for select
  using (id = public.jwt_tournament_id());

create policy "Admins can insert tournaments"
  on public.tournaments for insert
  with check (public.is_admin());

create policy "Tournament admins can update their tournament"
  on public.tournaments for update
  using (public.is_tournament_admin(id));

create policy "Tournament owners can delete their tournament"
  on public.tournaments for delete
  using (
    exists (
      select 1 from public.tournament_admins
      where tournament_id = id
        and admin_id = auth.uid()
        and role = 'owner'
    )
  );

-- ============================================
-- TOURNAMENT ADMINS
-- ============================================
create policy "Tournament admins can view co-admins"
  on public.tournament_admins for select
  using (public.is_tournament_admin(tournament_id));

create policy "Tournament owners can add co-admins"
  on public.tournament_admins for insert
  with check (
    exists (
      select 1 from public.tournament_admins
      where tournament_id = tournament_admins.tournament_id
        and admin_id = auth.uid()
        and role = 'owner'
    )
    -- Enforce max 3 admins at application layer (Edge Function)
  );

create policy "Tournament owners can remove co-admins"
  on public.tournament_admins for delete
  using (
    exists (
      select 1 from public.tournament_admins ta
      where ta.tournament_id = tournament_admins.tournament_id
        and ta.admin_id = auth.uid()
        and ta.role = 'owner'
    )
    and role = 'co_admin'  -- Can't delete self as owner via RLS
  );

-- ============================================
-- FLIGHTS
-- ============================================
create policy "Tournament admins can manage flights"
  on public.flights for all
  using (public.is_tournament_admin(tournament_id));

create policy "Team guests can read flights in their tournament"
  on public.flights for select
  using (tournament_id = public.jwt_tournament_id());

-- ============================================
-- FLIGHT PAYOUT TIERS
-- ============================================
create policy "Tournament admins can manage payout tiers"
  on public.flight_payout_tiers for all
  using (
    exists (
      select 1 from public.flights f
      where f.id = flight_id
        and public.is_tournament_admin(f.tournament_id)
    )
  );

create policy "Team guests can read payout tiers for their tournament"
  on public.flight_payout_tiers for select
  using (
    exists (
      select 1 from public.flights f
      where f.id = flight_id
        and f.tournament_id = public.jwt_tournament_id()
    )
  );

-- ============================================
-- PLAYERS
-- ============================================
create policy "Admins can manage players in their tournaments"
  on public.players for all
  using (
    -- Admins can manage any player they've referenced in their tournaments
    exists (
      select 1 from public.teams t
      join public.tournament_admins ta on ta.tournament_id = t.tournament_id
      where (t.player1_id = players.id or t.player2_id = players.id)
        and ta.admin_id = auth.uid()
    )
  );

create policy "App users can read their own player record"
  on public.players for select
  using (user_id = auth.uid());

create policy "App users can update their own player record"
  on public.players for update
  using (user_id = auth.uid());

create policy "Team guests can read players in their tournament"
  on public.players for select
  using (
    exists (
      select 1 from public.teams t
      where (t.player1_id = players.id or t.player2_id = players.id)
        and t.tournament_id = public.jwt_tournament_id()
    )
  );

-- ============================================
-- TEAMS
-- ============================================
create policy "Tournament admins can manage teams"
  on public.teams for all
  using (public.is_tournament_admin(tournament_id));

create policy "Team guests can read all teams in their tournament"
  on public.teams for select
  using (tournament_id = public.jwt_tournament_id());

-- ============================================
-- AUCTION SESSIONS
-- ============================================
create policy "Tournament admins can manage auction sessions"
  on public.auction_sessions for all
  using (public.is_tournament_admin(tournament_id));

create policy "Team guests can read auction sessions in their tournament"
  on public.auction_sessions for select
  using (tournament_id = public.jwt_tournament_id());

-- ============================================
-- BIDS
-- ============================================
create policy "Tournament admins can read all bids"
  on public.bids for select
  using (
    exists (
      select 1 from public.auction_sessions s
      where s.id = bids.auction_session_id
        and public.is_tournament_admin(s.tournament_id)
    )
  );

create policy "Team guests can read all bids in their tournament"
  on public.bids for select
  using (
    exists (
      select 1 from public.auction_sessions s
      where s.id = bids.auction_session_id
        and s.tournament_id = public.jwt_tournament_id()
    )
  );

-- Bids are inserted via the place_bid DB function (security definer)
-- Direct inserts from clients are blocked. The Edge Function calls the function.
-- No INSERT policy needed for bids — handled by service role via Edge Function.

-- ============================================
-- OWNERSHIPS
-- ============================================
create policy "Tournament admins can read all ownerships"
  on public.ownerships for select
  using (
    exists (
      select 1 from public.auction_sessions s
      where s.id = ownerships.auction_session_id
        and public.is_tournament_admin(s.tournament_id)
    )
  );

create policy "Tournament admins can update payment confirmation"
  on public.ownerships for update
  using (
    exists (
      select 1 from public.auction_sessions s
      where s.id = ownerships.auction_session_id
        and public.is_tournament_admin(s.tournament_id)
    )
  );

create policy "Team guests can read ownerships in their tournament"
  on public.ownerships for select
  using (
    -- Can see ownership where they are the owner or the team being owned
    (owner_team_id = public.jwt_team_id() or team_id = public.jwt_team_id())
    or
    exists (
      select 1 from public.auction_sessions s
      where s.id = ownerships.auction_session_id
        and s.tournament_id = public.jwt_tournament_id()
    )
  );

-- ============================================
-- BUYBACK REQUESTS
-- ============================================
create policy "Tournament admins can read all buyback requests"
  on public.buyback_requests for select
  using (
    exists (
      select 1 from public.auction_sessions s
      where s.id = buyback_requests.auction_session_id
        and public.is_tournament_admin(s.tournament_id)
    )
  );

create policy "Team guests can read buyback requests involving their team"
  on public.buyback_requests for select
  using (
    requesting_team_id = public.jwt_team_id()
    or confirmed_by_team_id = public.jwt_team_id()
    or exists (
      select 1 from public.auction_sessions s
      where s.id = buyback_requests.auction_session_id
        and s.winning_bidder_team_id = public.jwt_team_id()
    )
  );

-- Buyback inserts and updates handled via service role in handle-buyback Edge Function

-- ============================================
-- OWNERSHIP GROUP INVITES
-- ============================================
create policy "Tournament admins can read all group invites"
  on public.ownership_group_invites for select
  using (
    exists (
      select 1 from public.auction_sessions s
      where s.id = ownership_group_invites.auction_session_id
        and public.is_tournament_admin(s.tournament_id)
    )
  );

create policy "Team guests can read invites they sent or received"
  on public.ownership_group_invites for select
  using (
    invited_team_id = public.jwt_team_id()
    or exists (
      select 1 from public.ownerships o
      where o.id = primary_ownership_id
        and o.owner_team_id = public.jwt_team_id()
    )
  );

create policy "Owners can create group invites for their purchase"
  on public.ownership_group_invites for insert
  with check (
    exists (
      select 1 from public.ownerships o
      where o.id = primary_ownership_id
        and o.owner_team_id = public.jwt_team_id()
        and o.ownership_type = 'purchase'
    )
  );

create policy "Invited teams can update their own invites (accept/decline)"
  on public.ownership_group_invites for update
  using (invited_team_id = public.jwt_team_id());

create policy "Owners can delete pending invites they created"
  on public.ownership_group_invites for delete
  using (
    status = 'pending'
    and exists (
      select 1 from public.ownerships o
      where o.id = primary_ownership_id
        and o.owner_team_id = public.jwt_team_id()
    )
  );
