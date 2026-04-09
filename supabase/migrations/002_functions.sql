-- ============================================
-- CALCUTTA APP — DATABASE FUNCTIONS & TRIGGERS
-- Migration 002
-- ============================================

-- ============================================
-- HELPER FUNCTIONS
-- ============================================

-- Read team_id from the custom JWT claim (team guests)
create or replace function public.jwt_team_id()
returns uuid as $$
  select nullif(auth.jwt() ->> 'team_id', '')::uuid
$$ language sql stable security definer;

-- Read tournament_id from the custom JWT claim (team guests)
create or replace function public.jwt_tournament_id()
returns uuid as $$
  select nullif(auth.jwt() ->> 'tournament_id', '')::uuid
$$ language sql stable security definer;

-- Check if the current auth.uid() is an admin for the given tournament
create or replace function public.is_tournament_admin(p_tournament_id uuid)
returns boolean as $$
  select exists (
    select 1 from public.tournament_admins
    where tournament_id = p_tournament_id
      and admin_id = auth.uid()
  )
$$ language sql stable security definer;

-- Check if current user is any admin (has an admin_profile row)
create or replace function public.is_admin()
returns boolean as $$
  select exists (
    select 1 from public.admin_profiles where id = auth.uid()
  )
$$ language sql stable security definer;

-- ============================================
-- ACCESS CODE GENERATION
-- Charset excludes visually ambiguous characters (0/O, 1/I/L)
-- 32^6 = ~1.07 billion combinations, globally unique
-- ============================================
create or replace function public.generate_access_code()
returns char(6) as $$
declare
  charset text := 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  code char(6);
  attempts int := 0;
begin
  loop
    -- Build 6-char random string from charset
    code := '';
    for i in 1..6 loop
      code := code || substr(charset, floor(random() * length(charset))::int + 1, 1);
    end loop;

    -- Check global uniqueness
    if not exists (select 1 from public.teams where access_code = code) then
      return code;
    end if;

    attempts := attempts + 1;
    if attempts > 100 then
      raise exception 'ACCESS_CODE_GENERATION_FAILED after 100 attempts';
    end if;
  end loop;
end;
$$ language plpgsql security definer;

-- ============================================
-- TRIGGER: Auto-generate access_code on team INSERT
-- ============================================
create or replace function public.trg_team_access_code()
returns trigger as $$
begin
  if new.access_code is null or new.access_code = '' then
    new.access_code := public.generate_access_code();
  end if;
  return new;
end;
$$ language plpgsql;

create trigger trg_team_access_code
  before insert on public.teams
  for each row execute function public.trg_team_access_code();

-- ============================================
-- TRIGGER: Auto-create auction_session when team is inserted
-- Opens in 'pending' status; admin starts each one during the auction
-- ============================================
create or replace function public.trg_team_create_auction_session()
returns trigger as $$
declare
  v_timer int;
begin
  select timer_duration_seconds into v_timer
  from public.tournaments where id = new.tournament_id;

  insert into public.auction_sessions (
    tournament_id,
    team_id,
    status,
    opening_bid_cents,
    timer_duration_seconds
  ) values (
    new.tournament_id,
    new.id,
    'pending',
    0,           -- Admin sets opening bid before starting each session
    v_timer
  );
  return new;
end;
$$ language plpgsql security definer;

create trigger trg_team_create_auction_session
  after insert on public.teams
  for each row execute function public.trg_team_create_auction_session();

-- ============================================
-- TRIGGER: updated_at maintenance
-- ============================================
create or replace function public.trg_set_updated_at()
returns trigger as $$
begin
  new.updated_at := now();
  return new;
end;
$$ language plpgsql;

create trigger trg_tournaments_updated_at
  before update on public.tournaments
  for each row execute function public.trg_set_updated_at();

create trigger trg_teams_updated_at
  before update on public.teams
  for each row execute function public.trg_set_updated_at();

create trigger trg_auction_sessions_updated_at
  before update on public.auction_sessions
  for each row execute function public.trg_set_updated_at();

create trigger trg_ownerships_updated_at
  before update on public.ownerships
  for each row execute function public.trg_set_updated_at();

create trigger trg_buyback_requests_updated_at
  before update on public.buyback_requests
  for each row execute function public.trg_set_updated_at();

create trigger trg_ownership_group_invites_updated_at
  before update on public.ownership_group_invites
  for each row execute function public.trg_set_updated_at();

-- ============================================
-- AUCTION ENGINE: start_auction_session
-- Called by admin to begin bidding on a specific team
-- Sets status to active, initializes timer
-- ============================================
create or replace function public.start_auction_session(
  p_session_id uuid,
  p_opening_bid_cents integer default 0
)
returns json as $$
declare
  v_session auction_sessions%rowtype;
  v_tournament tournaments%rowtype;
begin
  select * into v_session from public.auction_sessions
  where id = p_session_id for update;

  if not found then
    raise exception 'SESSION_NOT_FOUND';
  end if;

  if v_session.status != 'pending' then
    raise exception 'SESSION_NOT_PENDING current status: %', v_session.status;
  end if;

  select * into v_tournament
  from public.tournaments where id = v_session.tournament_id;

  -- Verify tournament is in auction_live status
  if v_tournament.status != 'auction_live' then
    raise exception 'TOURNAMENT_NOT_LIVE';
  end if;

  update public.auction_sessions set
    status               = 'active',
    opening_bid_cents    = p_opening_bid_cents,
    timer_started_at     = now(),
    timer_duration_seconds = v_tournament.timer_duration_seconds,
    updated_at           = now()
  where id = p_session_id;

  -- Update tournament pointer to current session
  update public.tournaments set
    current_auction_session_id = p_session_id,
    updated_at = now()
  where id = v_session.tournament_id;

  -- Update team status
  update public.teams set
    auction_status = 'active',
    updated_at = now()
  where id = v_session.team_id;

  return json_build_object(
    'success', true,
    'session_id', p_session_id,
    'timer_started_at', now(),
    'timer_duration_seconds', v_tournament.timer_duration_seconds,
    'opening_bid_cents', p_opening_bid_cents
  );
end;
$$ language plpgsql security definer;

-- ============================================
-- AUCTION ENGINE: place_bid
-- Core transactional bid function. Handles:
--   - Concurrency via FOR UPDATE row lock
--   - Bid amount validation
--   - Timer expiry check
--   - Automatic timer extension
--   - Previous winning bid demotion
-- ============================================
create or replace function public.place_bid(
  p_session_id       uuid,
  p_bidder_team_id   uuid,
  p_amount_cents     integer
)
returns json as $$
declare
  v_session        auction_sessions%rowtype;
  v_tournament     tournaments%rowtype;
  v_remaining_ms   numeric;
  v_min_required   integer;
  v_extended       boolean := false;
  v_new_timer_at   timestamptz;
begin
  -- Lock the session row for this transaction
  select * into v_session
  from public.auction_sessions
  where id = p_session_id
  for update;

  if not found then
    raise exception 'SESSION_NOT_FOUND';
  end if;

  if v_session.status != 'active' then
    raise exception 'AUCTION_NOT_ACTIVE';
  end if;

  -- Ensure bidder is in the same tournament
  if not exists (
    select 1 from public.teams
    where id = p_bidder_team_id
      and tournament_id = v_session.tournament_id
  ) then
    raise exception 'INVALID_BIDDER';
  end if;

  -- Prevent bidding on yourself (you already have the winning bid)
  if v_session.winning_bidder_team_id = p_bidder_team_id then
    raise exception 'ALREADY_WINNING';
  end if;

  -- Get tournament settings
  select * into v_tournament
  from public.tournaments where id = v_session.tournament_id;

  -- Determine minimum valid bid
  if v_session.current_bid_cents is null then
    -- First bid: must meet or beat the opening bid
    v_min_required := v_session.opening_bid_cents;
  else
    -- Subsequent bids: must exceed current by at least the increment
    v_min_required := v_session.current_bid_cents + v_tournament.min_bid_increment_cents;
  end if;

  if p_amount_cents < v_min_required then
    raise exception 'BID_TOO_LOW min_required: %', v_min_required;
  end if;

  -- Check timer hasn't expired (server-authoritative)
  v_remaining_ms := extract(epoch from (
    v_session.timer_started_at
    + make_interval(secs => v_session.timer_duration_seconds)
    - now()
  )) * 1000;

  if v_remaining_ms <= 0 then
    raise exception 'TIMER_EXPIRED';
  end if;

  -- Check if this bid triggers a timer extension
  if v_remaining_ms <= (v_tournament.timer_extension_threshold_seconds * 1000.0) then
    v_new_timer_at := now();
    v_extended := true;
  end if;

  -- Demote previous winning bid
  update public.bids
  set is_winning = false
  where auction_session_id = p_session_id and is_winning = true;

  -- Record the new bid
  insert into public.bids (auction_session_id, bidder_team_id, amount_cents, is_winning)
  values (p_session_id, p_bidder_team_id, p_amount_cents, true);

  -- Update the auction session
  update public.auction_sessions set
    current_bid_cents        = p_amount_cents,
    winning_bidder_team_id   = p_bidder_team_id,
    timer_started_at         = case when v_extended then v_new_timer_at
                                    else timer_started_at end,
    timer_duration_seconds   = case when v_extended then v_tournament.timer_extension_seconds
                                    else timer_duration_seconds end,
    extension_count          = case when v_extended then extension_count + 1
                                    else extension_count end,
    updated_at               = now()
  where id = p_session_id;

  return json_build_object(
    'success',            true,
    'amount_cents',       p_amount_cents,
    'extended',           v_extended,
    'timer_started_at',   case when v_extended then v_new_timer_at
                               else v_session.timer_started_at end,
    'timer_duration_seconds', case when v_extended then v_tournament.timer_extension_seconds
                                   else v_session.timer_duration_seconds end
  );
end;
$$ language plpgsql security definer;

-- ============================================
-- AUCTION ENGINE: close_auction_session
-- Called when timer expires (validated server-side before closing)
-- Creates the initial ownership record for the winning bidder
-- ============================================
create or replace function public.close_auction_session(p_session_id uuid)
returns json as $$
declare
  v_session  auction_sessions%rowtype;
  v_remaining_ms numeric;
begin
  select * into v_session
  from public.auction_sessions
  where id = p_session_id
  for update;

  if not found then
    raise exception 'SESSION_NOT_FOUND';
  end if;

  if v_session.status != 'active' then
    raise exception 'SESSION_NOT_ACTIVE';
  end if;

  -- Server-side timer validation: don't close early
  v_remaining_ms := extract(epoch from (
    v_session.timer_started_at
    + make_interval(secs => v_session.timer_duration_seconds)
    - now()
  )) * 1000;

  if v_remaining_ms > 500 then
    -- More than 500ms remaining — too early, reject
    raise exception 'TIMER_NOT_EXPIRED remaining_ms: %', v_remaining_ms;
  end if;

  if v_session.winning_bidder_team_id is null then
    -- No bids — mark as passed
    update public.auction_sessions set
      status     = 'passed',
      sold_at    = now(),
      updated_at = now()
    where id = p_session_id;

    update public.teams set
      auction_status = 'passed',
      updated_at = now()
    where id = v_session.team_id;

    return json_build_object('status', 'passed', 'session_id', p_session_id);
  end if;

  -- Mark as sold
  update public.auction_sessions set
    status     = 'sold',
    sold_at    = now(),
    updated_at = now()
  where id = p_session_id;

  -- Update team record
  update public.teams set
    auction_status         = 'sold',
    final_sale_price_cents = v_session.current_bid_cents,
    updated_at             = now()
  where id = v_session.team_id;

  -- Create initial ownership record (100% to winning bidder)
  insert into public.ownerships (
    auction_session_id,
    team_id,
    owner_team_id,
    ownership_type,
    ownership_percentage,
    amount_paid_cents,
    payment_confirmed
  ) values (
    p_session_id,
    v_session.team_id,
    v_session.winning_bidder_team_id,
    'purchase',
    100.000,
    v_session.current_bid_cents,
    false
  );

  return json_build_object(
    'status',                 'sold',
    'session_id',            p_session_id,
    'team_id',               v_session.team_id,
    'winning_bidder_team_id', v_session.winning_bidder_team_id,
    'sale_price_cents',      v_session.current_bid_cents
  );
end;
$$ language plpgsql security definer;

-- ============================================
-- BUYBACK: confirm_buyback
-- Called by the winning bidder to confirm they received cash
-- Redistributes ownership: all purchase/group_share rows halved,
-- new buyback row inserted for the player team at 50%
-- ============================================
create or replace function public.confirm_buyback(
  p_buyback_request_id uuid,
  p_confirming_team_id uuid
)
returns json as $$
declare
  v_buyback   buyback_requests%rowtype;
  v_session   auction_sessions%rowtype;
begin
  select * into v_buyback
  from public.buyback_requests
  where id = p_buyback_request_id
  for update;

  if not found then
    raise exception 'BUYBACK_NOT_FOUND';
  end if;

  if v_buyback.status != 'pending' then
    raise exception 'BUYBACK_NOT_PENDING';
  end if;

  select * into v_session
  from public.auction_sessions
  where id = v_buyback.auction_session_id;

  -- Only the winning bidder can confirm
  if v_session.winning_bidder_team_id != p_confirming_team_id then
    raise exception 'NOT_AUTHORIZED';
  end if;

  -- Halve all existing ownership percentages for this team
  update public.ownerships set
    ownership_percentage = ownership_percentage * 0.5,
    amount_paid_cents    = amount_paid_cents / 2,
    updated_at           = now()
  where auction_session_id = v_buyback.auction_session_id;

  -- Insert buyback ownership row for the player team (50%)
  insert into public.ownerships (
    auction_session_id,
    team_id,
    owner_team_id,
    ownership_type,
    ownership_percentage,
    amount_paid_cents,
    payment_confirmed,
    payment_confirmed_at
  ) values (
    v_buyback.auction_session_id,
    v_session.team_id,
    v_buyback.requesting_team_id,
    'buyback',
    50.000,
    v_buyback.amount_cents,
    true,   -- Player paid the winning bidder off-platform
    now()
  );

  -- Mark buyback confirmed
  update public.buyback_requests set
    status               = 'confirmed',
    confirmed_by_team_id = p_confirming_team_id,
    confirmed_at         = now(),
    updated_at           = now()
  where id = p_buyback_request_id;

  -- Also halve any pending ownership group invites
  update public.ownership_group_invites set
    percentage_offered = percentage_offered * 0.5,
    updated_at         = now()
  where auction_session_id = v_buyback.auction_session_id
    and status = 'pending';

  return json_build_object(
    'success',       true,
    'session_id',   v_buyback.auction_session_id,
    'buyback_pct',  50.0
  );
end;
$$ language plpgsql security definer;

-- ============================================
-- OWNERSHIP GROUP: accept_group_invite
-- Called by the invited team to join the ownership group
-- Transfers percentage from primary owner's stake to invitee
-- ============================================
create or replace function public.accept_group_invite(
  p_invite_id      uuid,
  p_accepting_team uuid
)
returns json as $$
declare
  v_invite      ownership_group_invites%rowtype;
  v_primary_own ownerships%rowtype;
begin
  select * into v_invite
  from public.ownership_group_invites
  where id = p_invite_id
  for update;

  if not found then
    raise exception 'INVITE_NOT_FOUND';
  end if;

  if v_invite.invited_team_id != p_accepting_team then
    raise exception 'NOT_AUTHORIZED';
  end if;

  if v_invite.status != 'pending' then
    raise exception 'INVITE_NOT_PENDING';
  end if;

  -- Get primary owner's current stake
  select * into v_primary_own
  from public.ownerships
  where id = v_invite.primary_ownership_id
  for update;

  -- Validate primary owner has enough stake left to transfer
  if v_primary_own.ownership_percentage < v_invite.percentage_offered then
    raise exception 'INSUFFICIENT_OWNERSHIP';
  end if;

  -- Reduce primary owner's stake
  update public.ownerships set
    ownership_percentage = ownership_percentage - v_invite.percentage_offered,
    amount_paid_cents    = amount_paid_cents - round(amount_paid_cents * v_invite.percentage_offered / ownership_percentage),
    updated_at           = now()
  where id = v_invite.primary_ownership_id;

  -- Create new ownership row for the group member
  insert into public.ownerships (
    auction_session_id,
    team_id,
    owner_team_id,
    ownership_type,
    ownership_percentage,
    amount_paid_cents,
    payment_confirmed
  )
  select
    v_primary_own.auction_session_id,
    v_primary_own.team_id,
    p_accepting_team,
    'group_share',
    v_invite.percentage_offered,
    round(v_primary_own.amount_paid_cents * v_invite.percentage_offered / v_primary_own.ownership_percentage),
    false
  ;

  -- Mark invite accepted
  update public.ownership_group_invites set
    status       = 'accepted',
    responded_at = now(),
    updated_at   = now()
  where id = p_invite_id;

  return json_build_object(
    'success',             true,
    'invite_id',          p_invite_id,
    'percentage_accepted', v_invite.percentage_offered
  );
end;
$$ language plpgsql security definer;

-- ============================================
-- RESULTS: calculate_winnings
-- Admin sets final_place for each team in a flight.
-- This function computes winnings for all teams in a flight
-- based on the configured payout tiers and the flight's prize pool.
-- Prize pool = sum of final_sale_price_cents for all sold teams in the flight.
-- ============================================
create or replace function public.calculate_flight_winnings(p_flight_id uuid)
returns json as $$
declare
  v_pool_cents  bigint;
  v_tier        flight_payout_tiers%rowtype;
  v_winnings    integer;
  v_team_id     uuid;
  v_count       int := 0;
begin
  -- Compute prize pool: sum of all sold teams' sale prices in this flight
  select coalesce(sum(final_sale_price_cents), 0) into v_pool_cents
  from public.teams
  where flight_id = p_flight_id
    and auction_status = 'sold';

  -- For each payout tier, find the team with that place and assign winnings
  for v_tier in
    select * from public.flight_payout_tiers
    where flight_id = p_flight_id
    order by place
  loop
    -- Find team with this final_place in the flight
    select id into v_team_id
    from public.teams
    where flight_id = p_flight_id
      and final_place = v_tier.place
    limit 1;

    if v_team_id is not null then
      v_winnings := round(v_pool_cents * v_tier.percentage / 100.0);

      update public.teams set
        winnings_cents = v_winnings,
        updated_at     = now()
      where id = v_team_id;

      v_count := v_count + 1;
    end if;
  end loop;

  return json_build_object(
    'flight_id',      p_flight_id,
    'pool_cents',     v_pool_cents,
    'teams_paid_out', v_count
  );
end;
$$ language plpgsql security definer;

-- ============================================
-- HISTORICAL STATS: team_historical_stats
-- Returns avg sale price, avg winnings, and tournament count
-- for a given player pairing (since 2026, app launch year)
-- Order of player1/player2 does not matter
-- ============================================
create or replace function public.team_historical_stats(
  p_player1_id uuid,
  p_player2_id uuid
)
returns json as $$
declare
  v_avg_sale_cents    numeric;
  v_avg_winnings_cents numeric;
  v_tournament_count  int;
begin
  select
    count(*)                                    as tournament_count,
    avg(t.final_sale_price_cents)               as avg_sale_cents,
    avg(t.winnings_cents)                       as avg_winnings_cents
  into
    v_tournament_count,
    v_avg_sale_cents,
    v_avg_winnings_cents
  from public.teams t
  join public.tournaments tn on tn.id = t.tournament_id
  where
    (
      (t.player1_id = p_player1_id and t.player2_id = p_player2_id)
      or
      (t.player1_id = p_player2_id and t.player2_id = p_player1_id)
    )
    and tn.status = 'complete'         -- Only count completed tournaments
    and date_part('year', tn.tournament_date) >= 2026;

  return json_build_object(
    'tournament_count',       v_tournament_count,
    'avg_sale_price_cents',   round(coalesce(v_avg_sale_cents, 0)),
    'avg_winnings_cents',     round(coalesce(v_avg_winnings_cents, 0))
  );
end;
$$ language plpgsql security definer stable;
