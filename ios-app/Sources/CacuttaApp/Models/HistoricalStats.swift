import Foundation

// MARK: - HistoricalStats

struct HistoricalStats: Codable, Equatable {
    let player1Name: String
    let player2Name: String
    let tournamentsPlayed: Int
    let calcuttasEntered: Int
    let avgSalePriceCents: Int?
    let avgFinish: Double?
    let wins: Int
    let top3Finishes: Int
    let totalEarningsCents: Int
    let avgNetScore: Double?
    let avgGrossScore: Double?

    enum CodingKeys: String, CodingKey {
        case player1Name = "player1_name"
        case player2Name = "player2_name"
        case tournamentsPlayed = "tournaments_played"
        case calcuttasEntered = "calcuttas_entered"
        case avgSalePriceCents = "avg_sale_price_cents"
        case avgFinish = "avg_finish"
        case wins
        case top3Finishes = "top3_finishes"
        case totalEarningsCents = "total_earnings_cents"
        case avgNetScore = "avg_net_score"
        case avgGrossScore = "avg_gross_score"
    }

    var avgSalePriceDollars: Double? {
        avgSalePriceCents.map { Double($0) / 100.0 }
    }

    var totalEarningsDollars: Double {
        Double(totalEarningsCents) / 100.0
    }
}

// MARK: - Historical Stats Request

struct HistoricalStatsRequest: Codable {
    let player1Name: String
    let player2Name: String

    enum CodingKeys: String, CodingKey {
        case player1Name = "player1_name"
        case player2Name = "player2_name"
    }
}
