import SwiftUI

// MARK: - AuctionTimerView

struct AuctionTimerView: View {
    let remaining: TimeInterval
    let totalDuration: TimeInterval
    let isExtended: Bool
    let showExtendedLabel: Bool

    private var progress: Double {
        guard totalDuration > 0 else { return 0 }
        return max(0, min(1, remaining / totalDuration))
    }

    private var timerColor: Color {
        if remaining <= 3 { return Color(hex: "#ef4444") }
        if remaining <= 10 { return Color(hex: "#eab308") }
        return Color(hex: "#22c55e")
    }

    private var formattedTime: String {
        if remaining <= 0 { return "0" }
        if remaining >= 60 {
            let mins = Int(remaining) / 60
            let secs = Int(remaining) % 60
            return String(format: "%d:%02d", mins, secs)
        }
        return String(Int(ceil(remaining)))
    }

    var body: some View {
        ZStack {
            // Outer glow when urgent
            if remaining <= 3 && remaining > 0 {
                Circle()
                    .fill(Color(hex: "#ef4444").opacity(0.15))
                    .frame(width: 170, height: 170)
                    .scaleEffect(isExtended ? 1.05 : 1.0)
                    .animation(.easeInOut(duration: 0.5).repeatForever(autoreverses: true), value: remaining)
            }

            // Track ring
            Circle()
                .stroke(Color.white.opacity(0.06), lineWidth: 10)
                .frame(width: 148, height: 148)

            // Progress ring
            Circle()
                .trim(from: 0, to: progress)
                .stroke(
                    timerColor,
                    style: StrokeStyle(lineWidth: 10, lineCap: .round)
                )
                .frame(width: 148, height: 148)
                .rotationEffect(.degrees(-90))
                .animation(.linear(duration: 0.1), value: progress)

            // Center content
            VStack(spacing: 2) {
                Text(formattedTime)
                    .font(.system(size: remaining <= 9 ? 44 : 36, weight: .black, design: .rounded))
                    .foregroundStyle(timerColor)
                    .monospacedDigit()
                    .contentTransition(.numericText(countsDown: true))
                    .animation(.linear(duration: 0.1), value: formattedTime)

                if showExtendedLabel {
                    Text("EXTENDED")
                        .font(.system(size: 10, weight: .bold))
                        .foregroundStyle(Color(hex: "#eab308"))
                        .tracking(1.5)
                        .transition(.scale.combined(with: .opacity))
                }
            }
        }
        // Pulse animation when extended
        .scaleEffect(isExtended && showExtendedLabel ? 1.04 : 1.0)
        .animation(.spring(response: 0.3, dampingFraction: 0.5), value: showExtendedLabel)
    }
}

// MARK: - Sold / Passed Overlay

struct AuctionResultOverlay: View {
    let isSold: Bool
    let salePriceCents: Int?

    var body: some View {
        VStack(spacing: 8) {
            Image(systemName: isSold ? "checkmark.seal.fill" : "xmark.circle.fill")
                .font(.system(size: 44))
                .foregroundStyle(isSold ? Color(hex: "#22c55e") : Color(hex: "#94a3b8"))

            Text(isSold ? "SOLD" : "PASSED")
                .font(.system(size: 28, weight: .black))
                .foregroundStyle(isSold ? Color(hex: "#22c55e") : Color(hex: "#94a3b8"))
                .tracking(3)

            if isSold, let price = salePriceCents {
                CurrencyText(
                    cents: price,
                    font: .system(size: 20, weight: .bold),
                    color: Color(hex: "#22c55e")
                )
            }
        }
        .padding(32)
        .background(
            RoundedRectangle(cornerRadius: 20, style: .continuous)
                .fill(Color(hex: "#0f172a").opacity(0.95))
                .shadow(color: .black.opacity(0.4), radius: 20)
        )
        .transition(.scale.combined(with: .opacity))
    }
}

#Preview {
    VStack(spacing: 40) {
        AuctionTimerView(
            remaining: 8.5,
            totalDuration: 30,
            isExtended: false,
            showExtendedLabel: false
        )
        AuctionTimerView(
            remaining: 2.1,
            totalDuration: 30,
            isExtended: true,
            showExtendedLabel: true
        )
        AuctionResultOverlay(isSold: true, salePriceCents: 125000)
    }
    .padding()
    .background(Color(hex: "#020617"))
}
