import Foundation

// MARK: - Flight

struct Flight: Codable, Identifiable, Equatable {
    let id: UUID
    let tournamentId: UUID
    let name: String
    let handicapMin: Double?
    let handicapMax: Double?
    let payoutTiers: [PayoutTier]
    let order: Int

    enum CodingKeys: String, CodingKey {
        case id
        case tournamentId = "tournament_id"
        case name
        case handicapMin = "handicap_min"
        case handicapMax = "handicap_max"
        case payoutTiers = "payout_tiers"
        case order
    }

    var handicapRange: String {
        switch (handicapMin, handicapMax) {
        case let (min?, max?):
            return "HCP \(Int(min))–\(Int(max))"
        case let (min?, nil):
            return "HCP \(Int(min))+"
        case let (nil, max?):
            return "HCP up to \(Int(max))"
        default:
            return "Open"
        }
    }
}

// MARK: - PayoutTier

struct PayoutTier: Codable, Equatable {
    let place: Int
    let payoutCents: Int
    let description: String?

    enum CodingKeys: String, CodingKey {
        case place
        case payoutCents = "payout_cents"
        case description
    }
}

// MARK: - FlightResult (post-tournament)

struct FlightResult: Codable, Identifiable, Equatable {
    let id: UUID
    let flightId: UUID
    let teamId: UUID
    let teamName: String
    let place: Int
    let grossScore: Int?
    let netScore: Int?
    let payoutCents: Int

    enum CodingKeys: String, CodingKey {
        case id
        case flightId = "flight_id"
        case teamId = "team_id"
        case teamName = "team_name"
        case place
        case grossScore = "gross_score"
        case netScore = "net_score"
        case payoutCents = "payout_cents"
    }
}
