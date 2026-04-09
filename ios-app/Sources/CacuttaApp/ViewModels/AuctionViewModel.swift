import Foundation
import Combine
import SwiftUI

// MARK: - Toast

struct ToastMessage: Identifiable, Equatable {
    let id = UUID()
    let message: String
    let type: ToastType
    let actionLabel: String?
    let action: (() -> Void)?

    enum ToastType { case info, outbid, invite, sold }

    static func == (lhs: ToastMessage, rhs: ToastMessage) -> Bool { lhs.id == rhs.id }
}

// MARK: - AuctionViewModel

@MainActor
final class AuctionViewModel: ObservableObject {

    // MARK: - Published State

    @Published private(set) var currentSession: AuctionSession?
    @Published private(set) var currentTeam: Team?
    @Published private(set) var allTeams: [Team] = []
    @Published private(set) var allSessions: [AuctionSession] = []
    @Published private(set) var bids: [Bid] = []
    @Published private(set) var timerRemaining: TimeInterval = 0
    @Published private(set) var isExtended = false
    @Published private(set) var showExtendedLabel = false
    @Published private(set) var isSold = false
    @Published private(set) var isPassed = false
    @Published private(set) var isLoading = false
    @Published private(set) var errorMessage: String?
    @Published var toast: ToastMessage?
    @Published var showBidInput = false
    @Published var showBuybackPrompt = false
    @Published var pendingBuyback: BuybackAvailableEvent?
    @Published private(set) var isBidSubmitting = false
    @Published private(set) var bidError: String?

    // MARK: - Dependencies

    private let auctionService = AuctionService.shared
    private let tournamentService = TournamentService.shared
    private let authService = AuthService.shared
    private let haptic = HapticManager.shared

    private var cancellables = Set<AnyCancellable>()
    private var timerCancellable: AnyCancellable?

    // MARK: - Init

    init() {
        subscribeToRealtimeEvents()
        startTimerPublisher()
    }

    // MARK: - Load

    func load(tournament: Tournament) async {
        isLoading = true
        defer { isLoading = false }
        do {
            async let teamsTask = tournamentService.fetchTeams(tournamentId: tournament.id)
            async let sessionsTask = tournamentService.fetchAllSessions(tournamentId: tournament.id)

            let (teams, sessions) = try await (teamsTask, sessionsTask)
            allTeams = teams
            allSessions = sessions

            // Find active session
            if let active = sessions.first(where: { $0.status == .active }) {
                currentSession = active
                currentTeam = teams.first(where: { $0.id == active.teamId })
                bids = try await auctionService.fetchSessionBids(sessionId: active.id)
                timerRemaining = active.timerRemaining
            }

            // Subscribe to realtime
            await auctionService.subscribe(to: tournament.id)
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    // MARK: - Realtime Events

    private func subscribeToRealtimeEvents() {
        auctionService.eventPublisher
            .receive(on: DispatchQueue.main)
            .sink { [weak self] event in
                self?.handleRealtimeEvent(event)
            }
            .store(in: &cancellables)
    }

    private func handleRealtimeEvent(_ event: AuctionRealtimeEvent) {
        switch event {
        case let .teamStarted(session, teamId, _):
            currentSession = session
            currentTeam = allTeams.first(where: { $0.id == teamId })
            bids = []
            isSold = false
            isPassed = false
            isExtended = false
            timerRemaining = session.timerRemaining
            updateSessionInList(session)
            haptic.impact(.medium)

        case let .bidPlaced(e):
            handleBidPlaced(e, extended: e.extended)

        case let .bidPlacedExtended(e):
            handleBidPlaced(e, extended: e.extended)

        case let .teamSold(sessionId, teamId, price, winner):
            handleTeamSold(sessionId: sessionId, teamId: teamId, price: price, winner: winner)

        case let .teamPassed(sessionId, teamId):
            handleTeamPassed(sessionId: sessionId, teamId: teamId)

        case .auctionCompleted:
            currentSession = nil
            currentTeam = nil

        case let .buybackAvailable(e):
            if e.teamId == authService.currentTeamId {
                pendingBuyback = e
                showBuybackPrompt = true
            }

        case let .buybackRequested(e):
            // Notify winning bidder (if we are the winner)
            if currentSession?.winningBidderTeamId == authService.currentTeamId {
                toast = ToastMessage(
                    message: "Buyback request received for \(formatCents(e.amountCents))",
                    type: .info,
                    actionLabel: nil,
                    action: nil
                )
            }

        case .buybackConfirmed, .buybackDeclined:
            break

        case let .groupInviteReceived(e):
            toast = ToastMessage(
                message: "You received an ownership invite for \(String(format: "%.0f", e.percentageOffered))%",
                type: .invite,
                actionLabel: "View",
                action: nil
            )

        case .groupInviteAccepted, .groupInviteDeclined:
            break
        }
    }

    private func handleBidPlaced(_ event: BidPlacedEvent, extended: Bool) {
        // Update current session timer
        if var session = currentSession, session.id == event.sessionId {
            session = AuctionSession(
                id: session.id,
                tournamentId: session.tournamentId,
                teamId: session.teamId,
                status: session.status,
                openingBidCents: session.openingBidCents,
                currentHighBidCents: event.amountCents,
                currentHighBidderTeamId: event.bidderTeamId,
                salePriceCents: session.salePriceCents,
                winningBidderTeamId: session.winningBidderTeamId,
                timerStartedAt: event.timerStartedAt,
                timerDurationSeconds: event.timerDurationSeconds,
                extendedCount: session.extendedCount + (extended ? 1 : 0),
                createdAt: session.createdAt,
                updatedAt: Date()
            )
            currentSession = session
            timerRemaining = session.timerRemaining

            if extended && !isExtended {
                isExtended = true
                showExtendedLabel = true
                DispatchQueue.main.asyncAfter(deadline: .now() + 2.5) { [weak self] in
                    self?.showExtendedLabel = false
                }
                haptic.notification(.warning)
            }
        }

        // Add bid to feed
        let newBid = Bid(
            id: UUID(),
            sessionId: event.sessionId,
            bidderTeamId: event.bidderTeamId,
            amountCents: event.amountCents,
            placedAt: Date(),
            isWinning: true
        )
        bids.insert(newBid, at: 0)

        // Outbid toast: if we were the high bidder and this bid is from someone else
        let myTeamId = authService.currentTeamId
        if let prev = bids.dropFirst().first,
           prev.bidderTeamId == myTeamId,
           event.bidderTeamId != myTeamId {
            let teamName = currentTeam?.displayName ?? "this team"
            toast = ToastMessage(
                message: "You were outbid on \(teamName) — \(formatCents(event.amountCents))",
                type: .outbid,
                actionLabel: "Bid Again",
                action: { [weak self] in self?.showBidInput = true }
            )
            haptic.notification(.error)
        } else if event.bidderTeamId == myTeamId {
            haptic.impact(.heavy)
        }
    }

    private func handleTeamSold(sessionId: UUID, teamId: UUID, price: Int, winner: UUID) {
        isSold = true
        timerRemaining = 0
        haptic.notification(.success)

        if var session = currentSession, session.id == sessionId {
            session = AuctionSession(
                id: session.id,
                tournamentId: session.tournamentId,
                teamId: session.teamId,
                status: .sold,
                openingBidCents: session.openingBidCents,
                currentHighBidCents: price,
                currentHighBidderTeamId: winner,
                salePriceCents: price,
                winningBidderTeamId: winner,
                timerStartedAt: session.timerStartedAt,
                timerDurationSeconds: session.timerDurationSeconds,
                extendedCount: session.extendedCount,
                createdAt: session.createdAt,
                updatedAt: Date()
            )
            currentSession = session
            updateSessionInList(session)
        }

        // Update team status
        if let idx = allTeams.firstIndex(where: { $0.id == teamId }) {
            allTeams[idx] = Team(
                id: allTeams[idx].id,
                tournamentId: allTeams[idx].tournamentId,
                flightId: allTeams[idx].flightId,
                player1Name: allTeams[idx].player1Name,
                player2Name: allTeams[idx].player2Name,
                player1Handicap: allTeams[idx].player1Handicap,
                player2Handicap: allTeams[idx].player2Handicap,
                auctionStatus: .sold,
                auctionOrder: allTeams[idx].auctionOrder,
                accessCode: allTeams[idx].accessCode
            )
        }
    }

    private func handleTeamPassed(sessionId: UUID, teamId: UUID) {
        isPassed = true
        timerRemaining = 0
        if let idx = allTeams.firstIndex(where: { $0.id == teamId }) {
            allTeams[idx] = Team(
                id: allTeams[idx].id,
                tournamentId: allTeams[idx].tournamentId,
                flightId: allTeams[idx].flightId,
                player1Name: allTeams[idx].player1Name,
                player2Name: allTeams[idx].player2Name,
                player1Handicap: allTeams[idx].player1Handicap,
                player2Handicap: allTeams[idx].player2Handicap,
                auctionStatus: .passed,
                auctionOrder: allTeams[idx].auctionOrder,
                accessCode: allTeams[idx].accessCode
            )
        }
    }

    private func updateSessionInList(_ session: AuctionSession) {
        if let idx = allSessions.firstIndex(where: { $0.id == session.id }) {
            allSessions[idx] = session
        }
    }

    // MARK: - Timer Publisher

    private func startTimerPublisher() {
        timerCancellable = Timer.publish(every: 0.1, on: .main, in: .common)
            .autoconnect()
            .sink { [weak self] _ in
                guard let self else { return }
                if let session = self.currentSession, session.status == .active {
                    self.timerRemaining = session.timerRemaining
                }
            }
    }

    // MARK: - Place Bid

    func placeBid(amountCents: Int) async {
        guard let session = currentSession else { return }
        isBidSubmitting = true
        bidError = nil
        defer { isBidSubmitting = false }
        do {
            try await auctionService.placeBid(sessionId: session.id, amountCents: amountCents)
            showBidInput = false
            haptic.impact(.heavy)
        } catch {
            bidError = error.localizedDescription
            haptic.notification(.error)
        }
    }

    // MARK: - Helpers

    var minimumNextBidCents: Int {
        guard let session = currentSession,
              let tournament = authService.currentTournament else { return 0 }
        return session.minimumBidCents(
            incrementCents: tournament.auctionSettings.bidIncrementCents
        )
    }

    var isMyTeamCurrentlyUp: Bool {
        guard let myId = authService.currentTeamId,
              let session = currentSession else { return false }
        return session.teamId == myId
    }

    private func formatCents(_ cents: Int) -> String {
        CurrencyFormatter.format(cents: cents)
    }
}

// MARK: - Currency Formatter (shared utility)

enum CurrencyFormatter {
    static func format(cents: Int) -> String {
        let dollars = Double(cents) / 100.0
        let formatted = NumberFormatter.currency.string(from: NSNumber(value: dollars)) ?? "$0"
        return formatted
    }
}

extension NumberFormatter {
    static let currency: NumberFormatter = {
        let f = NumberFormatter()
        f.numberStyle = .currency
        f.maximumFractionDigits = 0
        f.minimumFractionDigits = 0
        return f
    }()
}
