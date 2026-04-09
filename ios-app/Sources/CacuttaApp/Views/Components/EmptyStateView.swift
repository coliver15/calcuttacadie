import SwiftUI

// MARK: - EmptyStateView

struct EmptyStateView: View {
    let systemImage: String
    let title: String
    let message: String
    var actionLabel: String? = nil
    var action: (() -> Void)? = nil

    var body: some View {
        VStack(spacing: 16) {
            ZStack {
                Circle()
                    .fill(Color(hex: "#0f172a"))
                    .frame(width: 72, height: 72)

                Image(systemName: systemImage)
                    .font(.system(size: 28))
                    .foregroundStyle(Color(hex: "#475569"))
            }

            VStack(spacing: 6) {
                Text(title)
                    .font(.system(size: 17, weight: .semibold))
                    .foregroundStyle(.white)

                Text(message)
                    .font(.system(size: 14))
                    .foregroundStyle(Color(hex: "#94a3b8"))
                    .multilineTextAlignment(.center)
                    .lineSpacing(3)
            }

            if let actionLabel, let action {
                Button(action: action) {
                    Text(actionLabel)
                        .font(.system(size: 15, weight: .medium))
                        .foregroundStyle(Color(hex: "#16a34a"))
                        .padding(.horizontal, 20)
                        .padding(.vertical, 10)
                        .background(Color(hex: "#16a34a").opacity(0.12))
                        .clipShape(Capsule())
                }
                .padding(.top, 4)
            }
        }
        .padding(.horizontal, 32)
        .padding(.vertical, 48)
        .frame(maxWidth: .infinity)
    }
}

#Preview {
    EmptyStateView(
        systemImage: "cart.badge.minus",
        title: "No Teams Yet",
        message: "Teams you purchase during the auction will appear here.",
        actionLabel: "Go to Auction",
        action: {}
    )
    .background(Color(hex: "#020617"))
}
