import SwiftUI

// MARK: - TeamRowView

struct TeamRowView: View {
    let team: Team
    let session: AuctionSession?
    let isMyTeam: Bool

    var body: some View {
        HStack(spacing: 12) {
            // Status indicator
            statusIndicator

            // Team info
            VStack(alignment: .leading, spacing: 3) {
                HStack(spacing: 6) {
                    Text(team.displayName)
                        .font(.system(size: 14, weight: isMyTeam ? .semibold : .regular))
                        .foregroundStyle(.white)
                        .lineLimit(1)

                    if isMyTeam {
                        Text("YOU")
                            .font(.system(size: 9, weight: .bold))
                            .foregroundStyle(Color(hex: "#22c55e"))
                            .padding(.horizontal, 5)
                            .padding(.vertical, 2)
                            .background(Color(hex: "#22c55e").opacity(0.15))
                            .clipShape(Capsule())
                    }
                }

                Text("HCP \(String(format: "%.1f", team.combinedHandicap))")
                    .font(.system(size: 11))
                    .foregroundStyle(Color(hex: "#64748b"))
            }

            Spacer()

            // Right side: status / price
            VStack(alignment: .trailing, spacing: 2) {
                statusBadge

                if let price = session?.salePriceCents {
                    CurrencyText(
                        cents: price,
                        font: .system(size: 13, weight: .semibold),
                        color: team.auctionStatus == .sold
                            ? Color(hex: "#22c55e")
                            : Color(hex: "#94a3b8")
                    )
                } else if let current = session?.currentHighBidCents {
                    CurrencyText(
                        cents: current,
                        font: .system(size: 13, weight: .semibold),
                        color: Color(hex: "#eab308")
                    )
                }
            }
        }
        .padding(.horizontal, 16)
        .padding(.vertical, 14)
        .background(
            team.auctionStatus == .active
                ? Color(hex: "#16a34a").opacity(0.05)
                : Color.clear
        )
    }

    // MARK: - Status Indicator

    @ViewBuilder
    private var statusIndicator: some View {
        Circle()
            .fill(statusColor.opacity(0.3))
            .frame(width: 8, height: 8)
            .overlay(
                Circle()
                    .fill(statusColor)
                    .frame(width: 5, height: 5)
            )
    }

    @ViewBuilder
    private var statusBadge: some View {
        Text(statusLabel)
            .font(.system(size: 10, weight: .semibold))
            .foregroundStyle(statusColor)
            .padding(.horizontal, 8)
            .padding(.vertical, 3)
            .background(statusColor.opacity(0.12))
            .clipShape(Capsule())
    }

    private var statusColor: Color {
        switch team.auctionStatus {
        case .pending: return Color(hex: "#475569")
        case .active: return Color(hex: "#22c55e")
        case .sold: return Color(hex: "#16a34a")
        case .passed: return Color(hex: "#64748b")
        }
    }

    private var statusLabel: String {
        switch team.auctionStatus {
        case .pending: return "Pending"
        case .active: return "Live"
        case .sold: return "Sold"
        case .passed: return "Passed"
        }
    }
}
