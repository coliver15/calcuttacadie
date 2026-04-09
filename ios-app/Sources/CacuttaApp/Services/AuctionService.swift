import Foundation
import Supabase
import Combine

// MARK: - Realtime Event Types

enum AuctionRealtimeEvent {
    case teamStarted(session: AuctionSession, teamId: UUID, openingBidCents: Int)
    case bidPlaced(BidPlacedEvent)
    case bidPlacedExtended(BidPlacedEvent)
    case teamSold(sessionId: UUID, teamId: UUID, salePriceCents: Int, winnerTeamId: UUID)
    case teamPassed(sessionId: UUID, teamId: UUID)
    case auctionCompleted(tournamentId: UUID)
    case buybackAvailable(BuybackAvailableEvent)
    case buybackRequested(BuybackRequestEvent)
    case buybackConfirmed(buybackRequestId: UUID)
    case buybackDeclined(buybackRequestId: UUID)
    case groupInviteReceived(GroupInviteReceivedEvent)
    case groupInviteAccepted(inviteId: UUID)
    case groupInviteDeclined(inviteId: UUID)
}

// MARK: - Team Started Event

struct TeamStartedEvent: Decodable {
    let sessionId: UUID
    let teamId: UUID
    let openingBidCents: Int
    let timerStartedAt: Date?
    let timerDurationSeconds: Int?

    enum CodingKeys: String, CodingKey {
        case sessionId = "session_id"
        case teamId = "team_id"
        case openingBidCents = "opening_bid_cents"
        case timerStartedAt = "timer_started_at"
        case timerDurationSeconds = "timer_duration_seconds"
    }
}

struct TeamSoldEvent: Decodable {
    let sessionId: UUID
    let teamId: UUID
    let salePriceCents: Int
    let winningBidderTeamId: UUID

    enum CodingKeys: String, CodingKey {
        case sessionId = "session_id"
        case teamId = "team_id"
        case salePriceCents = "sale_price_cents"
        case winningBidderTeamId = "winning_bidder_team_id"
    }
}

struct TeamPassedEvent: Decodable {
    let sessionId: UUID
    let teamId: UUID

    enum CodingKeys: String, CodingKey {
        case sessionId = "session_id"
        case teamId = "team_id"
    }
}

struct AuctionCompletedEvent: Decodable {
    let tournamentId: UUID

    enum CodingKeys: String, CodingKey {
        case tournamentId = "tournament_id"
    }
}

// MARK: - AuctionService

@MainActor
final class AuctionService: ObservableObject {
    static let shared = AuctionService()

    // Published realtime events for ViewModels to consume
    private let eventSubject = PassthroughSubject<AuctionRealtimeEvent, Never>()
    var eventPublisher: AnyPublisher<AuctionRealtimeEvent, Never> {
        eventSubject.eraseToAnyPublisher()
    }

    private let supabase = SupabaseService.shared
    private var realtimeChannel: RealtimeChannelV2?
    private var currentTournamentId: UUID?
    private var broadcastTasks: [Task<Void, Never>] = []

    private init() {}

    // MARK: - Realtime Subscription

    func subscribe(to tournamentId: UUID) async {
        guard tournamentId != currentTournamentId else { return }
        await unsubscribe()
        currentTournamentId = tournamentId

        let channelName = "auction:\(tournamentId.uuidString.lowercased())"
        let channel = supabase.client.realtimeV2.channel(channelName)
        realtimeChannel = channel

        // Register broadcast stream listeners BEFORE subscribing
        let teamStartedStream = channel.broadcastStream(event: "auction:team_started")
        let bidPlacedStream = channel.broadcastStream(event: "bid:placed")
        let bidExtendedStream = channel.broadcastStream(event: "bid:placed_extended")
        let soldStream = channel.broadcastStream(event: "auction:team_sold")
        let passedStream = channel.broadcastStream(event: "auction:team_passed")
        let completedStream = channel.broadcastStream(event: "auction:completed")
        let buybackAvailStream = channel.broadcastStream(event: "buyback:available")
        let buybackReqStream = channel.broadcastStream(event: "buyback:requested")
        let buybackConfStream = channel.broadcastStream(event: "buyback:confirmed")
        let buybackDecStream = channel.broadcastStream(event: "buyback:declined")
        let inviteRecvStream = channel.broadcastStream(event: "group:invite_received")
        let inviteAccStream = channel.broadcastStream(event: "group:invite_accepted")
        let inviteDecStream = channel.broadcastStream(event: "group:invite_declined")

        // Subscribe to channel
        await channel.subscribe()

        // Spin up async tasks to consume each stream
        let tasks: [Task<Void, Never>] = [
            Task { [weak self] in
                for await message in teamStartedStream {
                    await self?.handle(message, as: "auction:team_started")
                }
            },
            Task { [weak self] in
                for await message in bidPlacedStream {
                    await self?.handle(message, as: "bid:placed")
                }
            },
            Task { [weak self] in
                for await message in bidExtendedStream {
                    await self?.handle(message, as: "bid:placed_extended")
                }
            },
            Task { [weak self] in
                for await message in soldStream {
                    await self?.handle(message, as: "auction:team_sold")
                }
            },
            Task { [weak self] in
                for await message in passedStream {
                    await self?.handle(message, as: "auction:team_passed")
                }
            },
            Task { [weak self] in
                for await message in completedStream {
                    await self?.handle(message, as: "auction:completed")
                }
            },
            Task { [weak self] in
                for await message in buybackAvailStream {
                    await self?.handle(message, as: "buyback:available")
                }
            },
            Task { [weak self] in
                for await message in buybackReqStream {
                    await self?.handle(message, as: "buyback:requested")
                }
            },
            Task { [weak self] in
                for await message in buybackConfStream {
                    await self?.handle(message, as: "buyback:confirmed")
                }
            },
            Task { [weak self] in
                for await message in buybackDecStream {
                    await self?.handle(message, as: "buyback:declined")
                }
            },
            Task { [weak self] in
                for await message in inviteRecvStream {
                    await self?.handle(message, as: "group:invite_received")
                }
            },
            Task { [weak self] in
                for await message in inviteAccStream {
                    await self?.handle(message, as: "group:invite_accepted")
                }
            },
            Task { [weak self] in
                for await message in inviteDecStream {
                    await self?.handle(message, as: "group:invite_declined")
                }
            },
        ]
        broadcastTasks = tasks
    }

    func unsubscribe() async {
        broadcastTasks.forEach { $0.cancel() }
        broadcastTasks = []
        if let channel = realtimeChannel {
            await supabase.client.realtimeV2.removeChannel(channel)
            realtimeChannel = nil
        }
        currentTournamentId = nil
    }

    // MARK: - Event Decoding

    private func handle(_ message: JSONObject, as eventType: String) {
        do {
            let data = try JSONEncoder().encode(message)
            switch eventType {
            case "auction:team_started":
                let e = try JSONDecoder.iso8601Full.decode(TeamStartedEvent.self, from: data)
                let session = AuctionSession(
                    id: e.sessionId,
                    tournamentId: currentTournamentId ?? UUID(),
                    teamId: e.teamId,
                    status: .active,
                    openingBidCents: e.openingBidCents,
                    currentHighBidCents: nil,
                    currentHighBidderTeamId: nil,
                    salePriceCents: nil,
                    winningBidderTeamId: nil,
                    timerStartedAt: e.timerStartedAt,
                    timerDurationSeconds: e.timerDurationSeconds,
                    extendedCount: 0,
                    createdAt: Date(),
                    updatedAt: Date()
                )
                eventSubject.send(.teamStarted(session: session, teamId: e.teamId, openingBidCents: e.openingBidCents))
            case "bid:placed":
                let e = try JSONDecoder.iso8601Full.decode(BidPlacedEvent.self, from: data)
                eventSubject.send(.bidPlaced(e))
            case "bid:placed_extended":
                let e = try JSONDecoder.iso8601Full.decode(BidPlacedEvent.self, from: data)
                eventSubject.send(.bidPlacedExtended(e))
            case "auction:team_sold":
                let e = try JSONDecoder.iso8601Full.decode(TeamSoldEvent.self, from: data)
                eventSubject.send(.teamSold(
                    sessionId: e.sessionId,
                    teamId: e.teamId,
                    salePriceCents: e.salePriceCents,
                    winnerTeamId: e.winningBidderTeamId
                ))
            case "auction:team_passed":
                let e = try JSONDecoder.iso8601Full.decode(TeamPassedEvent.self, from: data)
                eventSubject.send(.teamPassed(sessionId: e.sessionId, teamId: e.teamId))
            case "auction:completed":
                let e = try JSONDecoder.iso8601Full.decode(AuctionCompletedEvent.self, from: data)
                eventSubject.send(.auctionCompleted(tournamentId: e.tournamentId))
            case "buyback:available":
                let e = try JSONDecoder.iso8601Full.decode(BuybackAvailableEvent.self, from: data)
                eventSubject.send(.buybackAvailable(e))
            case "buyback:requested":
                let e = try JSONDecoder.iso8601Full.decode(BuybackRequestEvent.self, from: data)
                eventSubject.send(.buybackRequested(e))
            case "buyback:confirmed":
                let id = try decodeId(from: data, key: "buyback_request_id")
                eventSubject.send(.buybackConfirmed(buybackRequestId: id))
            case "buyback:declined":
                let id = try decodeId(from: data, key: "buyback_request_id")
                eventSubject.send(.buybackDeclined(buybackRequestId: id))
            case "group:invite_received":
                let e = try JSONDecoder.iso8601Full.decode(GroupInviteReceivedEvent.self, from: data)
                eventSubject.send(.groupInviteReceived(e))
            case "group:invite_accepted":
                let e = try JSONDecoder.iso8601Full.decode(GroupInviteResponseEvent.self, from: data)
                eventSubject.send(.groupInviteAccepted(inviteId: e.inviteId))
            case "group:invite_declined":
                let e = try JSONDecoder.iso8601Full.decode(GroupInviteResponseEvent.self, from: data)
                eventSubject.send(.groupInviteDeclined(inviteId: e.inviteId))
            default:
                break
            }
        } catch {
            print("AuctionService: Failed to decode \(eventType): \(error)")
        }
    }

    private func decodeId(from data: Data, key: String) throws -> UUID {
        let json = try JSONDecoder().decode([String: String].self, from: data)
        guard let idString = json[key], let id = UUID(uuidString: idString) else {
            throw APIError.decodingError("Missing \(key)")
        }
        return id
    }

    // MARK: - Place Bid

    func placeBid(sessionId: UUID, amountCents: Int) async throws {
        let url = AppConfig.edgeFunctionBaseURL.appendingPathComponent("place-bid")
        struct BidBody: Encodable {
            let sessionId: UUID
            let amountCents: Int
            enum CodingKeys: String, CodingKey {
                case sessionId = "session_id"
                case amountCents = "amount_cents"
            }
        }
        let body = try JSONEncoder().encode(BidBody(sessionId: sessionId, amountCents: amountCents))
        let request = supabase.authenticatedRequest(url: url, method: "POST", body: body)
        _ = try await supabase.perform(request, as: EmptyResponse.self)
    }

    // MARK: - Fetch Active Sessions

    func fetchCurrentSession(tournamentId: UUID) async throws -> AuctionSession? {
        let response = try await supabase.client
            .from("auction_sessions")
            .select()
            .eq("tournament_id", value: tournamentId.uuidString)
            .eq("status", value: "active")
            .limit(1)
            .execute()
        let sessions = try JSONDecoder.iso8601Full.decode([AuctionSession].self, from: response.data)
        return sessions.first
    }

    func fetchSessionBids(sessionId: UUID) async throws -> [Bid] {
        let response = try await supabase.client
            .from("bids")
            .select()
            .eq("session_id", value: sessionId.uuidString)
            .order("placed_at", ascending: false)
            .execute()
        return try JSONDecoder.iso8601Full.decode([Bid].self, from: response.data)
    }
}

struct EmptyResponse: Decodable {}
