import Foundation
import Supabase

// MARK: - OwnershipGroupService

@MainActor
final class OwnershipGroupService: ObservableObject {
    static let shared = OwnershipGroupService()

    private let supabase = SupabaseService.shared

    private init() {}

    // MARK: - Send Invite

    /// Invite another team to share ownership of a session.
    func sendInvite(
        sessionId: UUID,
        invitedTeamId: UUID,
        percentageOffered: Double,
        amountCents: Int
    ) async throws -> OwnershipGroupInvite {
        let url = AppConfig.edgeFunctionBaseURL.appendingPathComponent("send-group-invite")
        struct InviteBody: Encodable {
            let sessionId: UUID
            let invitedTeamId: UUID
            let percentageOffered: Double
            let amountCents: Int
            enum CodingKeys: String, CodingKey {
                case sessionId = "session_id"
                case invitedTeamId = "invited_team_id"
                case percentageOffered = "percentage_offered"
                case amountCents = "amount_cents"
            }
        }
        let body = try JSONEncoder().encode(InviteBody(
            sessionId: sessionId,
            invitedTeamId: invitedTeamId,
            percentageOffered: percentageOffered,
            amountCents: amountCents
        ))
        let request = supabase.authenticatedRequest(url: url, method: "POST", body: body)
        return try await supabase.perform(request, as: OwnershipGroupInvite.self)
    }

    // MARK: - Accept Invite

    func acceptInvite(inviteId: UUID) async throws {
        let url = AppConfig.edgeFunctionBaseURL.appendingPathComponent("accept-group-invite")
        let body = try JSONEncoder.iso8601Full.encode(["invite_id": inviteId.uuidString])
        let request = supabase.authenticatedRequest(url: url, method: "POST", body: body)
        _ = try await supabase.perform(request, as: EmptyResponse.self)
    }

    // MARK: - Decline Invite

    func declineInvite(inviteId: UUID) async throws {
        let url = AppConfig.edgeFunctionBaseURL.appendingPathComponent("decline-group-invite")
        let body = try JSONEncoder.iso8601Full.encode(["invite_id": inviteId.uuidString])
        let request = supabase.authenticatedRequest(url: url, method: "POST", body: body)
        _ = try await supabase.perform(request, as: EmptyResponse.self)
    }

    // MARK: - Fetch Pending Invites

    func fetchPendingInvites(forTeamId teamId: UUID) async throws -> [OwnershipGroupInvite] {
        let response = try await supabase.client
            .from("ownership_group_invites")
            .select()
            .eq("invited_team_id", value: teamId.uuidString)
            .eq("status", value: "pending")
            .order("created_at", ascending: false)
            .execute()
        return try JSONDecoder.iso8601Full.decode([OwnershipGroupInvite].self, from: response.data)
    }

    // MARK: - Fetch Ownerships

    func fetchOwnerships(forTeamId teamId: UUID) async throws -> [Ownership] {
        let response = try await supabase.client
            .from("ownerships")
            .select()
            .eq("owner_team_id", value: teamId.uuidString)
            .execute()
        return try JSONDecoder.iso8601Full.decode([Ownership].self, from: response.data)
    }
}
