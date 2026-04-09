// Database types matching the Calcutta auction schema

export type TournamentStatus =
  | 'draft'
  | 'published'
  | 'auction_open'
  | 'auction_complete'
  | 'results_final'

export type AuctionOrderType = 'random' | 'manual' | 'handicap_desc' | 'handicap_asc'

export type AuctionSessionStatus = 'pending' | 'active' | 'sold' | 'passed' | 'closed'

export type OwnershipType = 'full' | 'partial'

export type PurchaseType = 'single' | 'five_pack'

export type PurchaseStatus = 'pending' | 'completed' | 'refunded'

export interface Tournament {
  id: string
  admin_id: string
  name: string
  club_name: string
  club_location: string
  tournament_date: string // ISO date string
  status: TournamentStatus
  timer_duration_seconds: number
  timer_extension_seconds: number
  timer_extension_threshold_seconds: number
  min_bid_increment_cents: number
  auction_order_type: AuctionOrderType
  current_auction_session_id: string | null
  created_at: string
  updated_at: string
}

export interface Flight {
  id: string
  tournament_id: string
  name: string
  display_order: number
  created_at: string
}

export interface FlightPayoutTier {
  id: string
  flight_id: string
  place: number
  percentage: number
}

export interface Team {
  id: string
  tournament_id: string
  flight_id: string | null
  player1_name: string
  player2_name: string
  player1_handicap_index: number | null
  player2_handicap_index: number | null
  access_code: string
  auction_order: number | null
  auction_status: 'pending' | 'active' | 'sold' | 'passed'
  final_sale_price_cents: number | null
  final_place: number | null
  winnings_cents: number | null
  created_at: string
}

export interface AuctionSession {
  id: string
  tournament_id: string
  team_id: string
  status: AuctionSessionStatus
  opening_bid_cents: number
  current_bid_cents: number
  winning_bidder_team_id: string | null
  timer_started_at: string | null // ISO timestamp
  timer_duration_seconds: number
  extension_count: number
  sold_at: string | null
  created_at: string
}

export interface Bid {
  id: string
  auction_session_id: string
  bidder_team_id: string
  amount_cents: number
  is_winning: boolean
  created_at: string
}

export interface Ownership {
  id: string
  auction_session_id: string
  team_id: string
  owner_team_id: string
  ownership_type: OwnershipType
  ownership_percentage: number
  amount_paid_cents: number
  payment_confirmed: boolean
  payment_confirmed_at: string | null
  created_at: string
}

export interface TournamentPurchase {
  id: string
  admin_id: string
  purchase_type: PurchaseType
  tournaments_total: number
  tournaments_remaining: number
  amount_paid_cents: number
  status: PurchaseStatus
  stripe_payment_intent_id: string | null
  stripe_session_id: string | null
  created_at: string
}

export interface AdminProfile {
  id: string
  email: string
  full_name: string
  created_at: string
}

export interface TournamentAdmin {
  id: string
  tournament_id: string
  admin_id: string
  role: 'owner' | 'co_admin'
  created_at: string
}

// Joined/enriched types used in the UI

export interface TeamWithFlight extends Team {
  flight: Flight | null
}

export interface AuctionSessionWithTeam extends AuctionSession {
  team: Team
}

export interface BidWithTeam extends Bid {
  bidder_team: Pick<Team, 'id' | 'player1_name' | 'player2_name'>
}

export interface OwnershipWithTeams extends Ownership {
  team: Pick<Team, 'id' | 'player1_name' | 'player2_name'>
  owner_team: Pick<Team, 'id' | 'player1_name' | 'player2_name'>
}

export interface TournamentWithStats extends Tournament {
  flights: Flight[]
  team_count: number
  teams_sold: number
  total_pot_cents: number
}

// Realtime event payloads

export interface RealtimeBidPlaced {
  type: 'bid:placed' | 'bid:placed_extended'
  auction_session_id: string
  bid: Bid
  current_bid_cents: number
  winning_bidder_team_id: string
  timer_started_at: string
  timer_duration_seconds: number
  extension_count: number
}

export interface RealtimeAuctionTeamStarted {
  type: 'auction:team_started'
  auction_session: AuctionSession
  team: Team
}

export interface RealtimeAuctionTeamSold {
  type: 'auction:team_sold'
  auction_session: AuctionSession
  team: Team
  winning_bidder_team_id: string
  final_amount_cents: number
}

export interface RealtimeAuctionTeamPassed {
  type: 'auction:team_passed'
  auction_session: AuctionSession
  team: Team
}

export interface RealtimeAuctionCompleted {
  type: 'auction:completed'
  tournament_id: string
}

export type RealtimeAuctionEvent =
  | RealtimeBidPlaced
  | RealtimeAuctionTeamStarted
  | RealtimeAuctionTeamSold
  | RealtimeAuctionTeamPassed
  | RealtimeAuctionCompleted

// Utility types

export type FormatCents = (cents: number) => string

export interface PaginatedResult<T> {
  data: T[]
  count: number
  page: number
  pageSize: number
}
