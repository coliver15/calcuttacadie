import SwiftUI

// MARK: - BidFeedView

struct BidFeedView: View {
    let bids: [Bid]
    let myTeamId: UUID?
    let allTeams: [Team]

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            if bids.isEmpty {
                HStack {
                    Spacer()
                    Text("No bids yet — be the first!")
                        .font(.system(size: 13))
                        .foregroundStyle(Color(hex: "#64748b"))
                    Spacer()
                }
                .padding(.vertical, 20)
            } else {
                ForEach(Array(bids.enumerated()), id: \.element.id) { index, bid in
                    BidRowView(
                        bid: bid,
                        isLeading: index == 0,
                        isMyBid: bid.bidderTeamId == myTeamId,
                        teamName: teamName(for: bid.bidderTeamId)
                    )

                    if index < bids.count - 1 {
                        Rectangle()
                            .fill(Color.white.opacity(0.04))
                            .frame(height: 1)
                            .padding(.horizontal, 16)
                    }
                }
            }
        }
        .background(Color(hex: "#0f172a"))
        .clipShape(RoundedRectangle(cornerRadius: 14, style: .continuous))
        .overlay(
            RoundedRectangle(cornerRadius: 14, style: .continuous)
                .stroke(Color.white.opacity(0.06), lineWidth: 1)
        )
    }

    private func teamName(for teamId: UUID) -> String {
        allTeams.first(where: { $0.id == teamId })?.displayName ?? "Unknown Team"
    }
}

// MARK: - BidRowView

struct BidRowView: View {
    let bid: Bid
    let isLeading: Bool
    let isMyBid: Bool
    let teamName: String

    var body: some View {
        HStack(spacing: 12) {
            // Rank indicator
            ZStack {
                Circle()
                    .fill(isLeading
                          ? Color(hex: "#16a34a").opacity(0.2)
                          : Color.white.opacity(0.04))
                    .frame(width: 28, height: 28)

                if isLeading {
                    Image(systemName: "crown.fill")
                        .font(.system(size: 11))
                        .foregroundStyle(Color(hex: "#22c55e"))
                } else {
                    Image(systemName: "circle.fill")
                        .font(.system(size: 6))
                        .foregroundStyle(Color(hex: "#475569"))
                }
            }

            // Team name
            VStack(alignment: .leading, spacing: 2) {
                HStack(spacing: 6) {
                    Text(teamName)
                        .font(.system(size: 13, weight: isMyBid ? .semibold : .regular))
                        .foregroundStyle(isMyBid ? Color(hex: "#22c55e") : .white)
                        .lineLimit(1)

                    if isMyBid {
                        Text("YOU")
                            .font(.system(size: 9, weight: .bold))
                            .foregroundStyle(Color(hex: "#22c55e"))
                            .padding(.horizontal, 5)
                            .padding(.vertical, 2)
                            .background(Color(hex: "#22c55e").opacity(0.15))
                            .clipShape(Capsule())
                    }
                }

                Text(bid.placedAt.formatted(.relative(presentation: .named)))
                    .font(.system(size: 11))
                    .foregroundStyle(Color(hex: "#475569"))
            }

            Spacer()

            // Amount
            CurrencyText(
                cents: bid.amountCents,
                font: .system(size: 15, weight: isLeading ? .bold : .medium),
                color: isLeading ? Color(hex: "#22c55e") : Color(hex: "#94a3b8")
            )
        }
        .padding(.horizontal, 16)
        .padding(.vertical, 12)
        .background(
            isLeading
                ? Color(hex: "#16a34a").opacity(0.05)
                : Color.clear
        )
        .transition(.asymmetric(insertion: .push(from: .top), removal: .opacity))
    }
}
