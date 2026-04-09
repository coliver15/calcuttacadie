import Foundation

// MARK: - Team

struct Team: Codable, Identifiable, Equatable {
    let id: UUID
    let tournamentId: UUID
    let flightId: UUID?
    let player1Name: String
    let player2Name: String
    let player1Handicap: Double
    let player2Handicap: Double
    let auctionStatus: TeamAuctionStatus
    let auctionOrder: Int?
    let accessCode: String?

    enum CodingKeys: String, CodingKey {
        case id
        case tournamentId = "tournament_id"
        case flightId = "flight_id"
        case player1Name = "player1_name"
        case player2Name = "player2_name"
        case player1Handicap = "player1_handicap"
        case player2Handicap = "player2_handicap"
        case auctionStatus = "auction_status"
        case auctionOrder = "auction_order"
        case accessCode = "access_code"
    }

    var displayName: String {
        "\(player1Name) / \(player2Name)"
    }

    var combinedHandicap: Double {
        player1Handicap + player2Handicap
    }
}

enum TeamAuctionStatus: String, Codable, Equatable {
    case pending
    case active
    case sold
    case passed
}
