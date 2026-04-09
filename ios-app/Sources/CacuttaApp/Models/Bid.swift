import Foundation

// MARK: - Bid

struct Bid: Codable, Identifiable, Equatable {
    let id: UUID
    let sessionId: UUID
    let bidderTeamId: UUID
    let amountCents: Int
    let placedAt: Date
    let isWinning: Bool

    enum CodingKeys: String, CodingKey {
        case id
        case sessionId = "session_id"
        case bidderTeamId = "bidder_team_id"
        case amountCents = "amount_cents"
        case placedAt = "placed_at"
        case isWinning = "is_winning"
    }
}

// MARK: - Realtime Bid Event

struct BidPlacedEvent: Decodable {
    let sessionId: UUID
    let bidderTeamId: UUID
    let amountCents: Int
    let extended: Bool
    let timerStartedAt: Date?
    let timerDurationSeconds: Int?

    enum CodingKeys: String, CodingKey {
        case sessionId = "session_id"
        case bidderTeamId = "bidder_team_id"
        case amountCents = "amount_cents"
        case extended
        case timerStartedAt = "timer_started_at"
        case timerDurationSeconds = "timer_duration_seconds"
    }
}
