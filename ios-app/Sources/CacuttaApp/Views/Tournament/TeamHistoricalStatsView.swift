import SwiftUI

// MARK: - TeamHistoricalStatsView

struct TeamHistoricalStatsView: View {
    let player1Name: String
    let player2Name: String

    @StateObject private var viewModel = HistoricalStatsViewModel()

    var body: some View {
        ZStack {
            Color(hex: "#020617").ignoresSafeArea()

            if viewModel.isLoading {
                LoadingView(message: "Loading stats…")
            } else if let error = viewModel.errorMessage {
                EmptyStateView(
                    systemImage: "chart.bar.xaxis",
                    title: "No Data Found",
                    message: error
                )
            } else if let stats = viewModel.stats {
                statsContent(stats)
            } else {
                EmptyStateView(
                    systemImage: "chart.bar.xaxis",
                    title: "No Historical Data",
                    message: "This pairing has no recorded Calcutta history."
                )
            }
        }
        .navigationTitle("Historical Stats")
        .navigationBarTitleDisplayMode(.inline)
        .toolbarBackground(Color(hex: "#020617"), for: .navigationBar)
        .task {
            await viewModel.fetchStats(player1Name: player1Name, player2Name: player2Name)
        }
    }

    // MARK: - Stats Content

    private func statsContent(_ stats: HistoricalStats) -> some View {
        ScrollView {
            VStack(spacing: 20) {
                // Pair names header
                VStack(spacing: 6) {
                    Text("\(player1Name) / \(player2Name)")
                        .font(.system(size: 20, weight: .bold))
                        .foregroundStyle(.white)
                        .multilineTextAlignment(.center)
                    Text("Historical Calcutta Performance")
                        .font(.system(size: 13))
                        .foregroundStyle(Color(hex: "#94a3b8"))
                }
                .padding(.top, 8)

                // Primary stats grid
                LazyVGrid(columns: [GridItem(.flexible()), GridItem(.flexible()), GridItem(.flexible())], spacing: 10) {
                    StatBox(
                        label: "Events",
                        value: "\(stats.calcuttasEntered)"
                    )
                    StatBox(
                        label: "Wins",
                        value: "\(stats.wins)",
                        valueColor: stats.wins > 0 ? Color(hex: "#22c55e") : .white
                    )
                    StatBox(
                        label: "Win Rate",
                        value: viewModel.winRateString,
                        valueColor: Color(hex: "#22c55e")
                    )
                    StatBox(
                        label: "Top 3",
                        value: viewModel.top3RateString
                    )
                    StatBox(
                        label: "Avg Finish",
                        value: viewModel.avgFinishString
                    )
                    StatBox(
                        label: "Avg Net",
                        value: viewModel.avgNetScoreString
                    )
                }
                .padding(.horizontal, 16)

                // Financial stats
                VStack(spacing: 0) {
                    financialRow(
                        icon: "hammer",
                        label: "Avg Sale Price",
                        value: viewModel.avgSalePriceString,
                        color: Color(hex: "#94a3b8")
                    )
                    Divider().background(Color.white.opacity(0.06))
                    financialRow(
                        icon: "dollarsign.circle.fill",
                        label: "Total Earnings",
                        value: viewModel.totalEarningsString,
                        color: Color(hex: "#22c55e")
                    )
                }
                .background(Color(hex: "#0f172a"))
                .clipShape(RoundedRectangle(cornerRadius: 14, style: .continuous))
                .overlay(
                    RoundedRectangle(cornerRadius: 14, style: .continuous)
                        .stroke(Color.white.opacity(0.06), lineWidth: 1)
                )
                .padding(.horizontal, 16)

                Spacer(minLength: 32)
            }
            .padding(.vertical, 8)
        }
    }

    private func financialRow(icon: String, label: String, value: String, color: Color) -> some View {
        HStack(spacing: 12) {
            Image(systemName: icon)
                .font(.system(size: 16))
                .foregroundStyle(Color(hex: "#475569"))
                .frame(width: 24)

            Text(label)
                .font(.system(size: 14))
                .foregroundStyle(Color(hex: "#94a3b8"))

            Spacer()

            Text(value)
                .font(.system(size: 16, weight: .bold))
                .foregroundStyle(color)
        }
        .padding(.horizontal, 16)
        .padding(.vertical, 14)
    }
}
