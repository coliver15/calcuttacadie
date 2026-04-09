import SwiftUI

// MARK: - BuybackPromptSheet

/// Shown to the sold team immediately after their team sells.
/// Lets them request a buyback from the winning bidder.
struct BuybackPromptSheet: View {
    let event: BuybackAvailableEvent
    let tournament: Tournament
    let onDismiss: () -> Void

    @State private var isRequesting = false
    @State private var hasRequested = false
    @State private var error: String?

    private let buybackService = BuybackService.shared

    var body: some View {
        ZStack {
            Color(hex: "#0f172a").ignoresSafeArea()

            VStack(spacing: 28) {
                // Header icon
                ZStack {
                    Circle()
                        .fill(Color(hex: "#16a34a").opacity(0.15))
                        .frame(width: 72, height: 72)
                    Image(systemName: "arrow.uturn.left.circle.fill")
                        .font(.system(size: 36))
                        .foregroundStyle(Color(hex: "#22c55e"))
                }
                .padding(.top, 8)

                VStack(spacing: 12) {
                    Text("Buyback Available")
                        .font(.system(size: 24, weight: .bold))
                        .foregroundStyle(.white)

                    VStack(spacing: 6) {
                        Text("Your team was sold for")
                            .font(.system(size: 15))
                            .foregroundStyle(Color(hex: "#94a3b8"))

                        CurrencyText(
                            cents: event.salePriceCents,
                            font: .system(size: 28, weight: .black),
                            color: Color(hex: "#94a3b8")
                        )

                        Text("You can buy back 50% for")
                            .font(.system(size: 15))
                            .foregroundStyle(Color(hex: "#94a3b8"))

                        CurrencyText(
                            cents: event.buybackAmountCents,
                            font: .system(size: 34, weight: .black),
                            color: Color(hex: "#22c55e")
                        )
                    }

                    Text("The winning bidder will be notified. They must confirm receipt of your cash payment.")
                        .font(.system(size: 13))
                        .foregroundStyle(Color(hex: "#64748b"))
                        .multilineTextAlignment(.center)
                        .padding(.horizontal, 16)
                }

                if hasRequested {
                    HStack(spacing: 8) {
                        Image(systemName: "checkmark.circle.fill")
                            .foregroundStyle(Color(hex: "#22c55e"))
                        Text("Buyback request sent!")
                            .font(.system(size: 15, weight: .medium))
                            .foregroundStyle(Color(hex: "#22c55e"))
                    }
                    .padding(.vertical, 12)
                    .padding(.horizontal, 20)
                    .background(Color(hex: "#22c55e").opacity(0.1))
                    .clipShape(RoundedRectangle(cornerRadius: 10))

                    Button("Done") { onDismiss() }
                        .font(.system(size: 16, weight: .medium))
                        .foregroundStyle(Color(hex: "#94a3b8"))
                        .padding(.bottom, 8)
                } else {
                    VStack(spacing: 12) {
                        if let error {
                            Text(error)
                                .font(.system(size: 13))
                                .foregroundStyle(Color(hex: "#ef4444"))
                        }

                        GolfGreenButton(
                            "Request Buyback — \(event.buybackAmountCents.dollarString)",
                            isLoading: isRequesting
                        ) {
                            await requestBuyback()
                        }

                        Button("No Thanks") { onDismiss() }
                            .font(.system(size: 15))
                            .foregroundStyle(Color(hex: "#94a3b8"))
                    }
                }
            }
            .padding(.horizontal, 24)
            .padding(.bottom, 32)
        }
    }

    private func requestBuyback() async {
        isRequesting = true
        error = nil
        defer { isRequesting = false }
        do {
            _ = try await buybackService.requestBuyback(sessionId: event.sessionId)
            hasRequested = true
            HapticManager.shared.notification(.success)
        } catch {
            self.error = error.localizedDescription
            HapticManager.shared.notification(.error)
        }
    }
}
