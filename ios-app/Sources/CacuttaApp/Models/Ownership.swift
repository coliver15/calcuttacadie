import Foundation

// MARK: - Ownership

struct Ownership: Codable, Identifiable, Equatable {
    let id: UUID
    let tournamentId: UUID
    let teamId: UUID
    let ownerTeamId: UUID
    let percentageOwned: Double
    let amountPaidCents: Int
    let acquiredAt: Date

    enum CodingKeys: String, CodingKey {
        case id
        case tournamentId = "tournament_id"
        case teamId = "team_id"
        case ownerTeamId = "owner_team_id"
        case percentageOwned = "percentage_owned"
        case amountPaidCents = "amount_paid_cents"
        case acquiredAt = "acquired_at"
    }

    /// Estimated winnings based on percentage and a given total payout.
    func estimatedWinnings(totalPayoutCents: Int) -> Int {
        Int(Double(totalPayoutCents) * percentageOwned / 100.0)
    }
}

// MARK: - OwnershipGroup

struct OwnershipGroup: Codable, Identifiable, Equatable {
    let id: UUID
    let sessionId: UUID
    let teamId: UUID
    let members: [Ownership]
    let totalPercentageAssigned: Double

    enum CodingKeys: String, CodingKey {
        case id
        case sessionId = "session_id"
        case teamId = "team_id"
        case members
        case totalPercentageAssigned = "total_percentage_assigned"
    }
}
