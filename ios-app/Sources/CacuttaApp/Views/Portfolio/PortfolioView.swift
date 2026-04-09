import SwiftUI

// MARK: - PortfolioView

struct PortfolioView: View {
    let tournament: Tournament

    @EnvironmentObject private var viewModel: PortfolioViewModel
    @State private var selectedInvite: OwnershipGroupInvite?
    @State private var selectedBuybackRequest: BuybackRequest?

    private let authService = AuthService.shared
    private let tournamentService = TournamentService.shared

    var body: some View {
        NavigationStack {
            ZStack {
                Color(hex: "#020617").ignoresSafeArea()

                if viewModel.isLoading {
                    LoadingView(message: "Loading portfolio…")
                } else {
                    mainContent
                }
            }
            .navigationTitle("My Portfolio")
            .navigationBarTitleDisplayMode(.large)
            .toolbarBackground(Color(hex: "#020617"), for: .navigationBar)
            .refreshable { await viewModel.load(tournament: tournament) }
        }
        .preferredColorScheme(.dark)
        .sheet(item: $selectedInvite) { invite in
            GroupInviteSheet(
                invite: invite,
                invitingTeamName: "Unknown Team", // Ideally resolved from allTeams
                onAccept: { await viewModel.acceptInvite(invite) },
                onDecline: { await viewModel.declineInvite(invite) }
            )
            .presentationDetents([.large])
            .presentationDragIndicator(.visible)
        }
        .sheet(item: $selectedBuybackRequest) { request in
            BuybackConfirmView(
                request: request,
                requestingTeamName: "Unknown Team",
                onConfirm: { await viewModel.confirmBuyback(request) },
                onDecline: { await viewModel.declineBuyback(request) }
            )
            .presentationDetents([.medium, .large])
            .presentationDragIndicator(.visible)
        }
    }

    // MARK: - Main Content

    private var mainContent: some View {
        ScrollView {
            VStack(spacing: 20) {
                // Summary header
                if !viewModel.ownedTeams.isEmpty {
                    exposureSummary
                        .padding(.horizontal, 16)
                        .padding(.top, 8)
                }

                // Pending actions
                if !viewModel.pendingBuybackRequests.isEmpty {
                    pendingBuybackSection
                        .padding(.horizontal, 16)
                }

                if !viewModel.pendingInvites.isEmpty {
                    pendingInvitesSection
                        .padding(.horizontal, 16)
                }

                // Owned teams
                if viewModel.ownedTeams.isEmpty {
                    EmptyStateView(
                        systemImage: "briefcase",
                        title: "No Teams Yet",
                        message: "Teams you win at auction will appear here."
                    )
                    .padding(.top, 20)
                } else {
                    ownedTeamsSection
                        .padding(.horizontal, 16)
                }

                Spacer(minLength: 32)
            }
        }
    }

    // MARK: - Exposure Summary

    private var exposureSummary: some View {
        HStack(spacing: 12) {
            StatBox(
                label: "Teams Owned",
                value: "\(viewModel.teamsCount)",
                valueColor: Color(hex: "#22c55e")
            )
            StatBox(
                label: "Total Exposure",
                value: viewModel.totalExposureCents.dollarString,
                valueColor: Color(hex: "#eab308")
            )
        }
    }

    // MARK: - Pending Buybacks

    private var pendingBuybackSection: some View {
        VStack(alignment: .leading, spacing: 10) {
            sectionHeader(
                title: "Pending Buybacks",
                badge: viewModel.pendingBuybackRequests.count
            )

            ForEach(viewModel.pendingBuybackRequests) { request in
                buybackRequestCard(request)
            }
        }
    }

    private func buybackRequestCard(_ request: BuybackRequest) -> some View {
        HStack(spacing: 12) {
            Image(systemName: "dollarsign.circle.fill")
                .font(.system(size: 24))
                .foregroundStyle(Color(hex: "#eab308"))

            VStack(alignment: .leading, spacing: 3) {
                Text("Buyback Request")
                    .font(.system(size: 14, weight: .semibold))
                    .foregroundStyle(.white)
                Text("Cash payment: \(CurrencyFormatter.format(cents: request.amountCents))")
                    .font(.system(size: 12))
                    .foregroundStyle(Color(hex: "#94a3b8"))
            }

            Spacer()

            Button {
                selectedBuybackRequest = request
            } label: {
                Text("Review")
                    .font(.system(size: 13, weight: .semibold))
                    .foregroundStyle(Color(hex: "#eab308"))
                    .padding(.horizontal, 12)
                    .padding(.vertical, 6)
                    .background(Color(hex: "#eab308").opacity(0.12))
                    .clipShape(Capsule())
            }
        }
        .padding(14)
        .background(Color(hex: "#0f172a"))
        .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
        .overlay(
            RoundedRectangle(cornerRadius: 12, style: .continuous)
                .stroke(Color(hex: "#eab308").opacity(0.2), lineWidth: 1)
        )
    }

    // MARK: - Pending Invites

    private var pendingInvitesSection: some View {
        VStack(alignment: .leading, spacing: 10) {
            sectionHeader(
                title: "Ownership Invites",
                badge: viewModel.pendingInvites.count
            )

            ForEach(viewModel.pendingInvites) { invite in
                inviteCard(invite)
            }
        }
    }

    private func inviteCard(_ invite: OwnershipGroupInvite) -> some View {
        HStack(spacing: 12) {
            Image(systemName: "person.2.fill")
                .font(.system(size: 20))
                .foregroundStyle(Color(hex: "#22c55e"))

            VStack(alignment: .leading, spacing: 3) {
                Text(String(format: "%.0f%% stake offered", invite.percentageOffered))
                    .font(.system(size: 14, weight: .semibold))
                    .foregroundStyle(.white)
                Text("Cost: \(CurrencyFormatter.format(cents: invite.amountCents))")
                    .font(.system(size: 12))
                    .foregroundStyle(Color(hex: "#94a3b8"))
            }

            Spacer()

            Button {
                selectedInvite = invite
            } label: {
                Text("View")
                    .font(.system(size: 13, weight: .semibold))
                    .foregroundStyle(Color(hex: "#22c55e"))
                    .padding(.horizontal, 12)
                    .padding(.vertical, 6)
                    .background(Color(hex: "#22c55e").opacity(0.12))
                    .clipShape(Capsule())
            }
        }
        .padding(14)
        .background(Color(hex: "#0f172a"))
        .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
        .overlay(
            RoundedRectangle(cornerRadius: 12, style: .continuous)
                .stroke(Color(hex: "#22c55e").opacity(0.2), lineWidth: 1)
        )
    }

    // MARK: - Owned Teams

    private var ownedTeamsSection: some View {
        VStack(alignment: .leading, spacing: 10) {
            sectionHeader(title: "Your Teams")

            ForEach(viewModel.ownedTeams) { ownedTeam in
                OwnedTeamCard(ownedTeam: ownedTeam)
            }
        }
    }

    // MARK: - Section Header

    private func sectionHeader(title: String, badge: Int? = nil) -> some View {
        HStack(spacing: 6) {
            Text(title)
                .font(.system(size: 13, weight: .semibold))
                .foregroundStyle(Color(hex: "#94a3b8"))
                .textCase(.uppercase)
                .tracking(0.8)

            if let badge, badge > 0 {
                Text("\(badge)")
                    .font(.system(size: 10, weight: .bold))
                    .foregroundStyle(.white)
                    .padding(.horizontal, 6)
                    .padding(.vertical, 2)
                    .background(Color(hex: "#ef4444"))
                    .clipShape(Capsule())
            }

            Spacer()
        }
    }
}
