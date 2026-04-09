import SwiftUI

// MARK: - TeamAuctionCard

struct TeamAuctionCard: View {
    let team: Team
    let session: AuctionSession?
    let historicalStats: HistoricalStats?

    var body: some View {
        VStack(spacing: 0) {
            // Player names
            VStack(spacing: 6) {
                HStack(spacing: 0) {
                    playerNameView(name: team.player1Name, handicap: team.player1Handicap)
                    Text("  /  ")
                        .font(.system(size: 15))
                        .foregroundStyle(Color(hex: "#475569"))
                    playerNameView(name: team.player2Name, handicap: team.player2Handicap)
                }

                // Combined handicap
                HStack(spacing: 4) {
                    Image(systemName: "figure.golf")
                        .font(.system(size: 11))
                    Text("Combined HCP \(String(format: "%.1f", team.combinedHandicap))")
                        .font(.system(size: 12, weight: .medium))
                }
                .foregroundStyle(Color(hex: "#94a3b8"))
            }
            .padding(.horizontal, 20)
            .padding(.vertical, 18)

            // Divider
            Rectangle()
                .fill(Color.white.opacity(0.06))
                .frame(height: 1)

            // Historical stats (compact)
            if let stats = historicalStats {
                HStack(spacing: 0) {
                    miniStat(label: "Events", value: "\(stats.calcuttasEntered)")
                    miniStat(label: "Wins", value: "\(stats.wins)", highlight: stats.wins > 0)
                    miniStat(label: "Avg Finish", value: stats.avgFinish.map { String(format: "%.1f", $0) } ?? "—")
                    miniStat(label: "Avg Sale", value: stats.avgSalePriceCents.map { CurrencyFormatter.format(cents: $0) } ?? "—")
                }
                .padding(.vertical, 10)

                Rectangle()
                    .fill(Color.white.opacity(0.06))
                    .frame(height: 1)
            }

            // Current bid info
            if let session {
                HStack {
                    VStack(alignment: .leading, spacing: 3) {
                        Text("Opening Bid")
                            .font(.system(size: 11, weight: .medium))
                            .foregroundStyle(Color(hex: "#64748b"))
                            .textCase(.uppercase)
                            .tracking(0.5)
                        CurrencyText(
                            cents: session.openingBidCents,
                            font: .system(size: 16, weight: .semibold),
                            color: Color(hex: "#94a3b8")
                        )
                    }

                    Spacer()

                    if let highBid = session.currentHighBidCents {
                        VStack(alignment: .trailing, spacing: 3) {
                            Text("Current High")
                                .font(.system(size: 11, weight: .medium))
                                .foregroundStyle(Color(hex: "#64748b"))
                                .textCase(.uppercase)
                                .tracking(0.5)
                            CurrencyText(
                                cents: highBid,
                                font: .system(size: 22, weight: .bold),
                                color: Color(hex: "#22c55e")
                            )
                        }
                    }
                }
                .padding(.horizontal, 20)
                .padding(.vertical, 14)
            }
        }
        .background(Color(hex: "#0f172a"))
        .clipShape(RoundedRectangle(cornerRadius: 16, style: .continuous))
        .overlay(
            RoundedRectangle(cornerRadius: 16, style: .continuous)
                .stroke(Color.white.opacity(0.07), lineWidth: 1)
        )
    }

    // MARK: - Sub-views

    private func playerNameView(name: String, handicap: Double) -> some View {
        VStack(spacing: 2) {
            Text(name)
                .font(.system(size: 17, weight: .semibold))
                .foregroundStyle(.white)
                .lineLimit(1)
            Text("HCP \(String(format: "%.1f", handicap))")
                .font(.system(size: 11))
                .foregroundStyle(Color(hex: "#94a3b8"))
        }
    }

    private func miniStat(label: String, value: String, highlight: Bool = false) -> some View {
        VStack(spacing: 2) {
            Text(value)
                .font(.system(size: 14, weight: .semibold, design: .rounded))
                .foregroundStyle(highlight ? Color(hex: "#22c55e") : .white)
            Text(label)
                .font(.system(size: 10))
                .foregroundStyle(Color(hex: "#64748b"))
        }
        .frame(maxWidth: .infinity)
    }
}
