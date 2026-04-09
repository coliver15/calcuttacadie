import SwiftUI

// MARK: - FlightStandingsView

struct FlightStandingsView: View {
    let flight: Flight
    let results: [FlightResult]

    var body: some View {
        VStack(spacing: 0) {
            // Flight header
            HStack {
                VStack(alignment: .leading, spacing: 3) {
                    Text(flight.name)
                        .font(.system(size: 16, weight: .semibold))
                        .foregroundStyle(.white)
                    Text(flight.handicapRange)
                        .font(.system(size: 12))
                        .foregroundStyle(Color(hex: "#94a3b8"))
                }
                Spacer()

                // Total payout
                if let total = totalPayout {
                    VStack(alignment: .trailing, spacing: 2) {
                        Text("Total Payout")
                            .font(.system(size: 10))
                            .foregroundStyle(Color(hex: "#64748b"))
                        CurrencyText(
                            cents: total,
                            font: .system(size: 15, weight: .bold),
                            color: Color(hex: "#22c55e")
                        )
                    }
                }
            }
            .padding(.horizontal, 16)
            .padding(.vertical, 14)

            Rectangle()
                .fill(Color.white.opacity(0.06))
                .frame(height: 1)

            // Results list
            if results.isEmpty {
                Text("No results yet")
                    .font(.system(size: 13))
                    .foregroundStyle(Color(hex: "#64748b"))
                    .padding(20)
            } else {
                ForEach(Array(results.enumerated()), id: \.element.id) { index, result in
                    resultRow(result: result, isLast: index == results.count - 1)
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

    private var totalPayout: Int? {
        let total = results.reduce(0) { $0 + $1.payoutCents }
        return total > 0 ? total : nil
    }

    private func resultRow(result: FlightResult, isLast: Bool) -> some View {
        VStack(spacing: 0) {
            HStack(spacing: 12) {
                // Place medal
                ZStack {
                    Circle()
                        .fill(placeColor(result.place).opacity(0.2))
                        .frame(width: 32, height: 32)
                    Text(placeText(result.place))
                        .font(.system(size: 13, weight: .bold))
                        .foregroundStyle(placeColor(result.place))
                }

                VStack(alignment: .leading, spacing: 2) {
                    Text(result.teamName)
                        .font(.system(size: 14, weight: .medium))
                        .foregroundStyle(.white)
                        .lineLimit(1)

                    HStack(spacing: 8) {
                        if let gross = result.grossScore {
                            Text("Gross: \(gross)")
                                .font(.system(size: 11))
                                .foregroundStyle(Color(hex: "#64748b"))
                        }
                        if let net = result.netScore {
                            Text("Net: \(net)")
                                .font(.system(size: 11))
                                .foregroundStyle(Color(hex: "#64748b"))
                        }
                    }
                }

                Spacer()

                if result.payoutCents > 0 {
                    CurrencyText(
                        cents: result.payoutCents,
                        font: .system(size: 15, weight: .bold),
                        color: Color(hex: "#22c55e")
                    )
                }
            }
            .padding(.horizontal, 16)
            .padding(.vertical, 12)

            if !isLast {
                Rectangle()
                    .fill(Color.white.opacity(0.04))
                    .frame(height: 1)
                    .padding(.horizontal, 16)
            }
        }
    }

    private func placeColor(_ place: Int) -> Color {
        switch place {
        case 1: return Color(hex: "#eab308") // Gold
        case 2: return Color(hex: "#94a3b8") // Silver
        case 3: return Color(hex: "#a16207") // Bronze
        default: return Color(hex: "#475569")
        }
    }

    private func placeText(_ place: Int) -> String {
        switch place {
        case 1: return "1st"
        case 2: return "2nd"
        case 3: return "3rd"
        default: return "\(place)th"
        }
    }
}
