import Foundation
import Supabase

// MARK: - BuybackService

@MainActor
final class BuybackService: ObservableObject {
    static let shared = BuybackService()

    private let supabase = SupabaseService.shared

    private init() {}

    // MARK: - Request Buyback

    /// Called by the sold team to request a buyback from the winning bidder.
    func requestBuyback(sessionId: UUID) async throws -> BuybackRequest {
        let url = AppConfig.edgeFunctionBaseURL.appendingPathComponent("request-buyback")
        let body = try JSONEncoder.iso8601Full.encode(["session_id": sessionId.uuidString])
        let request = supabase.authenticatedRequest(url: url, method: "POST", body: body)
        return try await supabase.perform(request, as: BuybackRequest.self)
    }

    // MARK: - Confirm Buyback (Winning Bidder)

    /// Called by the winning bidder to confirm they received cash for the buyback.
    func confirmBuyback(buybackRequestId: UUID) async throws {
        let url = AppConfig.edgeFunctionBaseURL.appendingPathComponent("confirm-buyback")
        let body = try JSONEncoder.iso8601Full.encode([
            "buyback_request_id": buybackRequestId.uuidString
        ])
        let request = supabase.authenticatedRequest(url: url, method: "POST", body: body)
        _ = try await supabase.perform(request, as: EmptyResponse.self)
    }

    // MARK: - Decline Buyback (Winning Bidder)

    /// Called by the winning bidder to decline the buyback request.
    func declineBuyback(buybackRequestId: UUID) async throws {
        let url = AppConfig.edgeFunctionBaseURL.appendingPathComponent("decline-buyback")
        let body = try JSONEncoder.iso8601Full.encode([
            "buyback_request_id": buybackRequestId.uuidString
        ])
        let request = supabase.authenticatedRequest(url: url, method: "POST", body: body)
        _ = try await supabase.perform(request, as: EmptyResponse.self)
    }

    // MARK: - Fetch Pending Buyback Requests

    /// Fetch buyback requests directed at the current team (as winning bidder).
    func fetchPendingBuybackRequests(forTeamId teamId: UUID) async throws -> [BuybackRequest] {
        let response = try await supabase.client
            .from("buyback_requests")
            .select("""
                id, session_id, requesting_team_id, amount_cents,
                status, created_at, updated_at,
                auction_sessions!inner(winning_bidder_team_id)
            """)
            .eq("auction_sessions.winning_bidder_team_id", value: teamId.uuidString)
            .eq("status", value: "pending")
            .execute()
        return try JSONDecoder.iso8601Full.decode([BuybackRequest].self, from: response.data)
    }

    /// Fetch buyback requests made by the current team.
    func fetchMyBuybackRequests(teamId: UUID) async throws -> [BuybackRequest] {
        let response = try await supabase.client
            .from("buyback_requests")
            .select()
            .eq("requesting_team_id", value: teamId.uuidString)
            .order("created_at", ascending: false)
            .execute()
        return try JSONDecoder.iso8601Full.decode([BuybackRequest].self, from: response.data)
    }

    // MARK: - Calculate Buyback Amount

    /// Returns the buyback amount in cents given a sale price and the tournament's buyback percentage.
    func buybackAmount(salePriceCents: Int, percentage: Double) -> Int {
        Int(Double(salePriceCents) * percentage / 100.0)
    }
}
