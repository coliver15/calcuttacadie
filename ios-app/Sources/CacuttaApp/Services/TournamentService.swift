import Foundation
import Supabase

// MARK: - TournamentService

@MainActor
final class TournamentService: ObservableObject {
    static let shared = TournamentService()

    private let supabase = SupabaseService.shared

    private init() {}

    // MARK: - Tournament

    func fetchTournament(id: UUID) async throws -> Tournament {
        let response = try await supabase.client
            .from("tournaments")
            .select("""
                id, name, club_name, course_name, start_date, end_date,
                status, auction_settings, created_at
            """)
            .eq("id", value: id.uuidString)
            .single()
            .execute()
        return try JSONDecoder.iso8601Full.decode(Tournament.self, from: response.data)
    }

    // MARK: - Teams

    func fetchTeams(tournamentId: UUID) async throws -> [Team] {
        let response = try await supabase.client
            .from("teams")
            .select()
            .eq("tournament_id", value: tournamentId.uuidString)
            .order("auction_order", ascending: true)
            .execute()
        return try JSONDecoder.iso8601Full.decode([Team].self, from: response.data)
    }

    func fetchTeam(id: UUID) async throws -> Team {
        let response = try await supabase.client
            .from("teams")
            .select()
            .eq("id", value: id.uuidString)
            .single()
            .execute()
        return try JSONDecoder.iso8601Full.decode(Team.self, from: response.data)
    }

    // MARK: - Auction Sessions

    func fetchAllSessions(tournamentId: UUID) async throws -> [AuctionSession] {
        let response = try await supabase.client
            .from("auction_sessions")
            .select()
            .eq("tournament_id", value: tournamentId.uuidString)
            .order("created_at", ascending: true)
            .execute()
        return try JSONDecoder.iso8601Full.decode([AuctionSession].self, from: response.data)
    }

    func fetchSession(id: UUID) async throws -> AuctionSession {
        let response = try await supabase.client
            .from("auction_sessions")
            .select()
            .eq("id", value: id.uuidString)
            .single()
            .execute()
        return try JSONDecoder.iso8601Full.decode(AuctionSession.self, from: response.data)
    }

    // MARK: - Flights

    func fetchFlights(tournamentId: UUID) async throws -> [Flight] {
        let response = try await supabase.client
            .from("flights")
            .select()
            .eq("tournament_id", value: tournamentId.uuidString)
            .order("order", ascending: true)
            .execute()
        return try JSONDecoder.iso8601Full.decode([Flight].self, from: response.data)
    }

    // MARK: - Flight Results

    func fetchFlightResults(tournamentId: UUID) async throws -> [FlightResult] {
        let response = try await supabase.client
            .from("flight_results")
            .select()
            .eq("tournament_id", value: tournamentId.uuidString)
            .order("place", ascending: true)
            .execute()
        return try JSONDecoder.iso8601Full.decode([FlightResult].self, from: response.data)
    }

    // MARK: - Historical Stats

    func fetchHistoricalStats(player1Name: String, player2Name: String) async throws -> HistoricalStats {
        let response = try await supabase.client
            .rpc(
                "get_pair_historical_stats",
                params: ["p1": player1Name, "p2": player2Name]
            )
            .execute()
        return try JSONDecoder.iso8601Full.decode(HistoricalStats.self, from: response.data)
    }
}
