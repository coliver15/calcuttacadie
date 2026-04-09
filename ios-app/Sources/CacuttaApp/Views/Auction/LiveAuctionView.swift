import SwiftUI

// MARK: - LiveAuctionView

struct LiveAuctionView: View {
    @EnvironmentObject private var viewModel: AuctionViewModel

    private let authService = AuthService.shared

    var body: some View {
        NavigationStack {
            ZStack {
                Color(hex: "#020617").ignoresSafeArea()

                if viewModel.isLoading {
                    LoadingView(message: "Connecting to auction…")
                } else if viewModel.currentSession == nil {
                    noActiveSessionView
                } else {
                    activeAuctionContent
                }
            }
            .navigationTitle("Live Auction")
            .navigationBarTitleDisplayMode(.inline)
            .toolbarBackground(Color(hex: "#020617"), for: .navigationBar)
            .toolbar {
                ToolbarItem(placement: .navigationBarTrailing) {
                    NavigationLink {
                        AllTeamsListView(
                            teams: viewModel.allTeams,
                            sessions: viewModel.allSessions,
                            myTeamId: authService.currentTeamId
                        )
                        .navigationTitle("All Teams")
                        .navigationBarTitleDisplayMode(.inline)
                    } label: {
                        Image(systemName: "list.bullet")
                            .foregroundStyle(Color(hex: "#94a3b8"))
                    }
                }
            }
        }
        .sheet(isPresented: $viewModel.showBidInput) {
            BidInputView()
                .environmentObject(viewModel)
                .presentationDetents([.large])
                .presentationDragIndicator(.visible)
        }
        .preferredColorScheme(.dark)
    }

    // MARK: - Active Auction Content

    private var activeAuctionContent: some View {
        ScrollView {
            VStack(spacing: 16) {
                // Timer + Result overlay
                ZStack {
                    if let session = viewModel.currentSession {
                        AuctionTimerView(
                            remaining: viewModel.timerRemaining,
                            totalDuration: Double(session.timerDurationSeconds ?? 30),
                            isExtended: viewModel.isExtended,
                            showExtendedLabel: viewModel.showExtendedLabel
                        )
                    }

                    // Sold / Passed overlay
                    if viewModel.isSold || viewModel.isPassed {
                        AuctionResultOverlay(
                            isSold: viewModel.isSold,
                            salePriceCents: viewModel.currentSession?.salePriceCents
                        )
                        .transition(.scale(scale: 0.8).combined(with: .opacity))
                    }
                }
                .padding(.vertical, 16)
                .animation(.spring(response: 0.4, dampingFraction: 0.7), value: viewModel.isSold || viewModel.isPassed)

                // Team card
                if let team = viewModel.currentTeam {
                    TeamAuctionCard(
                        team: team,
                        session: viewModel.currentSession,
                        historicalStats: nil // Load separately via HistoricalStatsViewModel if needed
                    )
                    .padding(.horizontal, 16)
                }

                // Bid button (not shown for your own team or when expired)
                if !viewModel.isSold && !viewModel.isPassed && !viewModel.isMyTeamCurrentlyUp {
                    bidButton
                        .padding(.horizontal, 16)
                }

                // Bid feed
                if !viewModel.bids.isEmpty {
                    VStack(alignment: .leading, spacing: 8) {
                        Text("Bid History")
                            .font(.system(size: 13, weight: .semibold))
                            .foregroundStyle(Color(hex: "#94a3b8"))
                            .textCase(.uppercase)
                            .tracking(0.8)
                            .padding(.horizontal, 16)

                        BidFeedView(
                            bids: viewModel.bids,
                            myTeamId: authService.currentTeamId,
                            allTeams: viewModel.allTeams
                        )
                        .padding(.horizontal, 16)
                    }
                }

                Spacer(minLength: 32)
            }
        }
        .refreshable {
            if let tournament = authService.currentTournament {
                await viewModel.load(tournament: tournament)
            }
        }
    }

    // MARK: - Bid Button

    private var bidButton: some View {
        VStack(spacing: 8) {
            if viewModel.timerRemaining > 0 {
                GolfGreenButton("Place Bid — \(viewModel.minimumNextBidCents.dollarString) min") {
                    viewModel.showBidInput = true
                }
            } else {
                GolfGreenButton("Waiting…", isDisabled: true) {}
            }
        }
    }

    // MARK: - No Active Session

    private var noActiveSessionView: some View {
        VStack(spacing: 0) {
            // All teams list header
            HStack {
                Text("All Teams")
                    .font(.system(size: 20, weight: .bold))
                    .foregroundStyle(.white)
                Spacer()

                let soldCount = viewModel.allTeams.filter { $0.auctionStatus == .sold }.count
                Text("\(soldCount)/\(viewModel.allTeams.count) sold")
                    .font(.system(size: 13))
                    .foregroundStyle(Color(hex: "#94a3b8"))
            }
            .padding(.horizontal, 16)
            .padding(.top, 16)
            .padding(.bottom, 12)

            if viewModel.allTeams.isEmpty {
                EmptyStateView(
                    systemImage: "hammer",
                    title: "Auction Not Started",
                    message: "The auction hasn't begun yet. Check back soon!"
                )
            } else {
                AllTeamsListView(
                    teams: viewModel.allTeams,
                    sessions: viewModel.allSessions,
                    myTeamId: authService.currentTeamId
                )
            }
        }
    }
}
