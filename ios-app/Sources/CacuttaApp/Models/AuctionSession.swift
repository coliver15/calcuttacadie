import Foundation

// MARK: - AuctionSession

struct AuctionSession: Codable, Identifiable, Equatable {
    let id: UUID
    let tournamentId: UUID
    let teamId: UUID
    let status: AuctionSessionStatus
    let openingBidCents: Int
    let currentHighBidCents: Int?
    let currentHighBidderTeamId: UUID?
    let salePriceCents: Int?
    let winningBidderTeamId: UUID?
    let timerStartedAt: Date?
    let timerDurationSeconds: Int?
    let extendedCount: Int
    let createdAt: Date
    let updatedAt: Date

    enum CodingKeys: String, CodingKey {
        case id
        case tournamentId = "tournament_id"
        case teamId = "team_id"
        case status
        case openingBidCents = "opening_bid_cents"
        case currentHighBidCents = "current_high_bid_cents"
        case currentHighBidderTeamId = "current_high_bidder_team_id"
        case salePriceCents = "sale_price_cents"
        case winningBidderTeamId = "winning_bidder_team_id"
        case timerStartedAt = "timer_started_at"
        case timerDurationSeconds = "timer_duration_seconds"
        case extendedCount = "extended_count"
        case createdAt = "created_at"
        case updatedAt = "updated_at"
    }

    // MARK: - Computed Timer

    /// Seconds remaining on the auction clock. Server-authoritative.
    var timerRemaining: TimeInterval {
        guard let startedAt = timerStartedAt,
              let duration = timerDurationSeconds else {
            return 0
        }
        let deadline = startedAt.addingTimeInterval(TimeInterval(duration))
        return max(0, deadline.timeIntervalSinceNow)
    }

    var isTimerExpired: Bool {
        guard timerStartedAt != nil else { return false }
        return timerRemaining <= 0
    }

    // MARK: - Minimum Next Bid

    /// Minimum required bid in cents (current high + increment or opening bid).
    func minimumBidCents(incrementCents: Int) -> Int {
        if let current = currentHighBidCents {
            return current + incrementCents
        }
        return openingBidCents
    }
}

enum AuctionSessionStatus: String, Codable, Equatable {
    case pending
    case active
    case sold
    case passed
}
