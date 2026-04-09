import Foundation

// MARK: - BuybackRequest

struct BuybackRequest: Codable, Identifiable, Equatable {
    let id: UUID
    let sessionId: UUID
    let requestingTeamId: UUID
    let amountCents: Int
    let status: BuybackRequestStatus
    let createdAt: Date
    let updatedAt: Date

    enum CodingKeys: String, CodingKey {
        case id
        case sessionId = "session_id"
        case requestingTeamId = "requesting_team_id"
        case amountCents = "amount_cents"
        case status
        case createdAt = "created_at"
        case updatedAt = "updated_at"
    }
}

enum BuybackRequestStatus: String, Codable, Equatable {
    case pending
    case confirmed
    case declined
    case expired
}

// MARK: - Buyback Availability Event

struct BuybackAvailableEvent: Decodable {
    let sessionId: UUID
    let teamId: UUID
    let salePriceCents: Int
    let buybackAmountCents: Int

    enum CodingKeys: String, CodingKey {
        case sessionId = "session_id"
        case teamId = "team_id"
        case salePriceCents = "sale_price_cents"
        case buybackAmountCents = "buyback_amount_cents"
    }
}

// MARK: - Buyback Request Event

struct BuybackRequestEvent: Decodable {
    let buybackRequestId: UUID
    let sessionId: UUID
    let requestingTeamId: UUID
    let amountCents: Int

    enum CodingKeys: String, CodingKey {
        case buybackRequestId = "buyback_request_id"
        case sessionId = "session_id"
        case requestingTeamId = "requesting_team_id"
        case amountCents = "amount_cents"
    }
}
