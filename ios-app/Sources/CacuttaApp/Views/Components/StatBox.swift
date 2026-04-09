import SwiftUI

// MARK: - StatBox

struct StatBox: View {
    let label: String
    let value: String
    var valueColor: Color = .white
    var footnote: String? = nil

    var body: some View {
        VStack(spacing: 4) {
            Text(value)
                .font(.system(size: 22, weight: .bold, design: .rounded))
                .foregroundStyle(valueColor)
                .minimumScaleFactor(0.7)
                .lineLimit(1)

            Text(label)
                .font(.system(size: 11, weight: .medium))
                .foregroundStyle(Color(hex: "#94a3b8"))
                .multilineTextAlignment(.center)

            if let footnote {
                Text(footnote)
                    .font(.system(size: 10))
                    .foregroundStyle(Color(hex: "#64748b"))
            }
        }
        .padding(.horizontal, 12)
        .padding(.vertical, 14)
        .frame(maxWidth: .infinity)
        .background(Color(hex: "#0f172a"))
        .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
        .overlay(
            RoundedRectangle(cornerRadius: 12, style: .continuous)
                .stroke(Color.white.opacity(0.06), lineWidth: 1)
        )
    }
}

// MARK: - StatRow (inline horizontal stat)

struct StatRow: View {
    let label: String
    let value: String
    var valueColor: Color = .white

    var body: some View {
        HStack {
            Text(label)
                .font(.system(size: 14))
                .foregroundStyle(Color(hex: "#94a3b8"))
            Spacer()
            Text(value)
                .font(.system(size: 14, weight: .semibold))
                .foregroundStyle(valueColor)
        }
        .padding(.vertical, 2)
    }
}

#Preview {
    VStack(spacing: 12) {
        HStack(spacing: 8) {
            StatBox(label: "Tournaments", value: "12")
            StatBox(label: "Wins", value: "3", valueColor: Color(hex: "#22c55e"))
            StatBox(label: "Avg Sale", value: "$1,250")
        }
        StatRow(label: "Total Earnings", value: "$4,800", valueColor: Color(hex: "#22c55e"))
    }
    .padding()
    .background(Color(hex: "#020617"))
}
