import Foundation

// MARK: - OwnershipGroupInvite

struct OwnershipGroupInvite: Codable, Identifiable, Equatable {
    let id: UUID
    let sessionId: UUID
    let invitingTeamId: UUID
    let invitedTeamId: UUID
    let percentageOffered: Double
    let amountCents: Int
    let status: InviteStatus
    let expiresAt: Date?
    let createdAt: Date

    enum CodingKeys: String, CodingKey {
        case id
        case sessionId = "session_id"
        case invitingTeamId = "inviting_team_id"
        case invitedTeamId = "invited_team_id"
        case percentageOffered = "percentage_offered"
        case amountCents = "amount_cents"
        case status
        case expiresAt = "expires_at"
        case createdAt = "created_at"
    }
}

enum InviteStatus: String, Codable, Equatable {
    case pending
    case accepted
    case declined
    case expired
}

// MARK: - Group Invite Realtime Event

struct GroupInviteReceivedEvent: Decodable {
    let inviteId: UUID
    let sessionId: UUID
    let invitingTeamId: UUID
    let percentageOffered: Double

    enum CodingKeys: String, CodingKey {
        case inviteId = "invite_id"
        case sessionId = "session_id"
        case invitingTeamId = "inviting_team_id"
        case percentageOffered = "percentage_offered"
    }
}

struct GroupInviteResponseEvent: Decodable {
    let inviteId: UUID

    enum CodingKeys: String, CodingKey {
        case inviteId = "invite_id"
    }
}
