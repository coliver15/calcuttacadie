import SwiftUI

// MARK: - BuybackConfirmView

/// Shown to the winning bidder who has a pending buyback request.
/// They confirm they received cash, or decline.
struct BuybackConfirmView: View {
    let request: BuybackRequest
    let requestingTeamName: String
    let onConfirm: () async -> Void
    let onDecline: () async -> Void

    @State private var isConfirming = false
    @State private var isDeclining = false
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        ZStack {
            Color(hex: "#0f172a").ignoresSafeArea()

            VStack(spacing: 28) {
                // Header
                ZStack {
                    Circle()
                        .fill(Color(hex: "#eab308").opacity(0.15))
                        .frame(width: 72, height: 72)
                    Image(systemName: "dollarsign.circle.fill")
                        .font(.system(size: 36))
                        .foregroundStyle(Color(hex: "#eab308"))
                }
                .padding(.top, 8)

                VStack(spacing: 10) {
                    Text("Buyback Request")
                        .font(.system(size: 22, weight: .bold))
                        .foregroundStyle(.white)

                    Text(requestingTeamName)
                        .font(.system(size: 16, weight: .semibold))
                        .foregroundStyle(Color(hex: "#22c55e"))

                    Text("has requested to buy 50% of their team back for:")
                        .font(.system(size: 14))
                        .foregroundStyle(Color(hex: "#94a3b8"))
                        .multilineTextAlignment(.center)

                    CurrencyText(
                        cents: request.amountCents,
                        font: .system(size: 36, weight: .black),
                        color: Color(hex: "#eab308")
                    )
                    .padding(.top, 4)

                    Text("Confirm only after you've received the cash payment.")
                        .font(.system(size: 13))
                        .foregroundStyle(Color(hex: "#64748b"))
                        .multilineTextAlignment(.center)
                        .padding(.horizontal, 16)
                }

                VStack(spacing: 12) {
                    GolfGreenButton("Confirm — Cash Received", isLoading: isConfirming) {
                        isConfirming = true
                        await onConfirm()
                        dismiss()
                    }

                    DangerButton("Decline Buyback") {
                        isDeclining = true
                        await onDecline()
                        dismiss()
                    }
                }
            }
            .padding(.horizontal, 24)
            .padding(.bottom, 32)
        }
    }
}
