import Foundation
import Combine

// MARK: - OwnedTeam

struct OwnedTeam: Identifiable, Equatable {
    let ownership: Ownership
    let team: Team
    let session: AuctionSession?

    var id: UUID { ownership.id }

    var displayName: String { team.displayName }

    var salePriceCents: Int? { session?.salePriceCents }

    /// Estimated share of winnings if any payout is known.
    func estimatedWinnings(totalPayoutCents: Int) -> Int {
        ownership.estimatedWinnings(totalPayoutCents: totalPayoutCents)
    }
}

// MARK: - PortfolioViewModel

@MainActor
final class PortfolioViewModel: ObservableObject {

    // MARK: - Published

    @Published private(set) var ownedTeams: [OwnedTeam] = []
    @Published private(set) var pendingInvites: [OwnershipGroupInvite] = []
    @Published private(set) var pendingBuybackRequests: [BuybackRequest] = []
    @Published private(set) var myBuybackRequests: [BuybackRequest] = []
    @Published private(set) var isLoading = false
    @Published private(set) var errorMessage: String?
    @Published var selectedInvite: OwnershipGroupInvite?
    @Published var showBuybackConfirm = false
    @Published var selectedBuybackRequest: BuybackRequest?

    // MARK: - Dependencies

    private let ownershipService = OwnershipGroupService.shared
    private let buybackService = BuybackService.shared
    private let tournamentService = TournamentService.shared
    private let authService = AuthService.shared
    private let auctionService = AuctionService.shared
    private var cancellables = Set<AnyCancellable>()

    init() {
        subscribeToRealtimeEvents()
    }

    // MARK: - Load

    func load(tournament: Tournament) async {
        guard let teamId = authService.currentTeamId else { return }
        isLoading = true
        defer { isLoading = false }
        do {
            async let ownershipsTask = ownershipService.fetchOwnerships(forTeamId: teamId)
            async let invitesTask = ownershipService.fetchPendingInvites(forTeamId: teamId)
            async let buybackReqTask = buybackService.fetchPendingBuybackRequests(forTeamId: teamId)
            async let myBuybackTask = buybackService.fetchMyBuybackRequests(teamId: teamId)

            let (ownerships, invites, buybackReqs, myBuybacks) = try await (
                ownershipsTask, invitesTask, buybackReqTask, myBuybackTask
            )

            pendingInvites = invites
            pendingBuybackRequests = buybackReqs
            myBuybackRequests = myBuybacks

            // Hydrate owned teams
            let allTeams = try await tournamentService.fetchTeams(tournamentId: tournament.id)
            let allSessions = try await tournamentService.fetchAllSessions(tournamentId: tournament.id)

            ownedTeams = ownerships.compactMap { ownership in
                guard let team = allTeams.first(where: { $0.id == ownership.teamId }) else { return nil }
                let session = allSessions.first(where: { $0.teamId == ownership.teamId })
                return OwnedTeam(ownership: ownership, team: team, session: session)
            }
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    // MARK: - Computed

    var totalExposureCents: Int {
        ownedTeams.reduce(0) { $0 + $1.ownership.amountPaidCents }
    }

    var teamsCount: Int { ownedTeams.count }

    // MARK: - Invite Actions

    func acceptInvite(_ invite: OwnershipGroupInvite) async {
        do {
            try await ownershipService.acceptInvite(inviteId: invite.id)
            pendingInvites.removeAll { $0.id == invite.id }
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    func declineInvite(_ invite: OwnershipGroupInvite) async {
        do {
            try await ownershipService.declineInvite(inviteId: invite.id)
            pendingInvites.removeAll { $0.id == invite.id }
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    // MARK: - Buyback Actions

    func confirmBuyback(_ request: BuybackRequest) async {
        do {
            try await buybackService.confirmBuyback(buybackRequestId: request.id)
            pendingBuybackRequests.removeAll { $0.id == request.id }
            showBuybackConfirm = false
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    func declineBuyback(_ request: BuybackRequest) async {
        do {
            try await buybackService.declineBuyback(buybackRequestId: request.id)
            pendingBuybackRequests.removeAll { $0.id == request.id }
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    // MARK: - Realtime

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
        case let .groupInviteReceived(e):
            // Refresh invites list
            Task { [weak self] in
                guard let self, let teamId = authService.currentTeamId else { return }
                pendingInvites = (try? await ownershipService.fetchPendingInvites(forTeamId: teamId)) ?? pendingInvites
            }
        case let .groupInviteAccepted(inviteId):
            pendingInvites.removeAll { $0.id == inviteId }
        case let .groupInviteDeclined(inviteId):
            pendingInvites.removeAll { $0.id == inviteId }
        case let .buybackRequested(e):
            // A new buyback request came in targeting us
            Task { [weak self] in
                guard let self, let teamId = authService.currentTeamId else { return }
                pendingBuybackRequests = (try? await buybackService.fetchPendingBuybackRequests(forTeamId: teamId)) ?? pendingBuybackRequests
            }
        case let .buybackConfirmed(requestId):
            myBuybackRequests = myBuybackRequests.map { req in
                if req.id == requestId {
                    return BuybackRequest(
                        id: req.id, sessionId: req.sessionId,
                        requestingTeamId: req.requestingTeamId,
                        amountCents: req.amountCents, status: .confirmed,
                        createdAt: req.createdAt, updatedAt: Date()
                    )
                }
                return req
            }
        case let .buybackDeclined(requestId):
            myBuybackRequests = myBuybackRequests.map { req in
                if req.id == requestId {
                    return BuybackRequest(
                        id: req.id, sessionId: req.sessionId,
                        requestingTeamId: req.requestingTeamId,
                        amountCents: req.amountCents, status: .declined,
                        createdAt: req.createdAt, updatedAt: Date()
                    )
                }
                return req
            }
        default:
            break
        }
    }
}
