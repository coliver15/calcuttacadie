import Foundation

// MARK: - Tournament

struct Tournament: Codable, Identifiable, Equatable {
    let id: UUID
    let name: String
    let clubName: String
    let courseName: String
    let startDate: Date
    let endDate: Date
    let status: TournamentStatus
    let auctionSettings: AuctionSettings
    let createdAt: Date

    enum CodingKeys: String, CodingKey {
        case id
        case name
        case clubName = "club_name"
        case courseName = "course_name"
        case startDate = "start_date"
        case endDate = "end_date"
        case status
        case auctionSettings = "auction_settings"
        case createdAt = "created_at"
    }
}

enum TournamentStatus: String, Codable, Equatable {
    case upcoming
    case auctionOpen = "auction_open"
    case auctionComplete = "auction_complete"
    case inProgress = "in_progress"
    case complete
}

// MARK: - Auction Settings

struct AuctionSettings: Codable, Equatable {
    let openingBidCents: Int
    let bidIncrementCents: Int
    let timerDurationSeconds: Int
    let extensionDurationSeconds: Int
    let extensionThresholdSeconds: Int
    let buybackPercentage: Double
    let allowGroupOwnership: Bool

    enum CodingKeys: String, CodingKey {
        case openingBidCents = "opening_bid_cents"
        case bidIncrementCents = "bid_increment_cents"
        case timerDurationSeconds = "timer_duration_seconds"
        case extensionDurationSeconds = "extension_duration_seconds"
        case extensionThresholdSeconds = "extension_threshold_seconds"
        case buybackPercentage = "buyback_percentage"
        case allowGroupOwnership = "allow_group_ownership"
    }
}
