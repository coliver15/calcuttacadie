import SwiftUI

// MARK: - MainTabView

struct MainTabView: View {
    let tournament: Tournament
    let myTeamId: UUID

    @StateObject private var auctionVM = AuctionViewModel()
    @StateObject private var portfolioVM = PortfolioViewModel()

    @State private var selectedTab = 0

    var body: some View {
        TabView(selection: $selectedTab) {
            // Auction Tab
            LiveAuctionView()
                .environmentObject(auctionVM)
                .tabItem {
                    Label("Auction", systemImage: "hammer.fill")
                }
                .tag(0)

            // Portfolio Tab
            PortfolioView(tournament: tournament)
                .environmentObject(portfolioVM)
                .tabItem {
                    Label("Portfolio", systemImage: "briefcase.fill")
                }
                .badge(portfolioVM.pendingInvites.count + portfolioVM.pendingBuybackRequests.count)
                .tag(1)

            // Tournament Tab
            TournamentInfoView(tournament: tournament)
                .tabItem {
                    Label("Tournament", systemImage: "flag.2.crossed.fill")
                }
                .tag(2)
        }
        .tint(Color(hex: "#22c55e"))
        .preferredColorScheme(.dark)
        .task {
            // Load data when tab view appears
            await auctionVM.load(tournament: tournament)
            await portfolioVM.load(tournament: tournament)
        }
        .toastOverlay(toast: $auctionVM.toast)
        .sheet(isPresented: $auctionVM.showBuybackPrompt) {
            if let buyback = auctionVM.pendingBuyback {
                BuybackPromptSheet(
                    event: buyback,
                    tournament: tournament,
                    onDismiss: { auctionVM.showBuybackPrompt = false }
                )
                .presentationDetents([.medium])
                .presentationDragIndicator(.visible)
            }
        }
    }
}
