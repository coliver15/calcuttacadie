import SwiftUI

// MARK: - OwnedTeamCard

struct OwnedTeamCard: View {
    let ownedTeam: OwnedTeam

    var body: some View {
        VStack(spacing: 0) {
            // Header
            HStack {
                VStack(alignment: .leading, spacing: 3) {
                    Text(ownedTeam.displayName)
                        .font(.system(size: 15, weight: .semibold))
                        .foregroundStyle(.white)
                        .lineLimit(1)

                    Text("HCP \(String(format: "%.1f", ownedTeam.team.combinedHandicap))")
                        .font(.system(size: 11))
                        .foregroundStyle(Color(hex: "#94a3b8"))
                }

                Spacer()

                // Ownership badge
                VStack(alignment: .trailing, spacing: 2) {
                    Text(String(format: "%.0f%%", ownedTeam.ownership.percentageOwned))
                        .font(.system(size: 22, weight: .black, design: .rounded))
                        .foregroundStyle(Color(hex: "#22c55e"))
                    Text("owned")
                        .font(.system(size: 10))
                        .foregroundStyle(Color(hex: "#64748b"))
                }
            }
            .padding(16)

            // Divider
            Rectangle()
                .fill(Color.white.opacity(0.06))
                .frame(height: 1)

            // Stats row
            HStack(spacing: 0) {
                statCell(
                    label: "Paid",
                    value: CurrencyFormatter.format(cents: ownedTeam.ownership.amountPaidCents)
                )

                Rectangle()
                    .fill(Color.white.opacity(0.06))
                    .frame(width: 1, height: 36)

                if let salePrice = ownedTeam.salePriceCents {
                    statCell(
                        label: "Sale Price",
                        value: CurrencyFormatter.format(cents: salePrice),
                        valueColor: Color(hex: "#94a3b8")
                    )

                    Rectangle()
                        .fill(Color.white.opacity(0.06))
                        .frame(width: 1, height: 36)
                }

                statCell(
                    label: "Status",
                    value: ownedTeam.team.auctionStatus == .sold ? "Sold" : "Live",
                    valueColor: ownedTeam.team.auctionStatus == .sold
                        ? Color(hex: "#22c55e")
                        : Color(hex: "#eab308")
                )
            }
            .padding(.vertical, 12)
        }
        .background(Color(hex: "#0f172a"))
        .clipShape(RoundedRectangle(cornerRadius: 14, style: .continuous))
        .overlay(
            RoundedRectangle(cornerRadius: 14, style: .continuous)
                .stroke(Color.white.opacity(0.07), lineWidth: 1)
        )
    }

    private func statCell(label: String, value: String, valueColor: Color = .white) -> some View {
        VStack(spacing: 2) {
            Text(value)
                .font(.system(size: 14, weight: .semibold))
                .foregroundStyle(valueColor)
                .minimumScaleFactor(0.8)
                .lineLimit(1)
            Text(label)
                .font(.system(size: 10))
                .foregroundStyle(Color(hex: "#64748b"))
        }
        .frame(maxWidth: .infinity)
    }
}
