import SwiftUI

// MARK: - GroupInviteSheet

struct GroupInviteSheet: View {
    let invite: OwnershipGroupInvite
    let invitingTeamName: String
    let onAccept: () async -> Void
    let onDecline: () async -> Void

    @State private var isAccepting = false
    @State private var isDeclining = false
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        ZStack {
            Color(hex: "#0f172a").ignoresSafeArea()

            VStack(spacing: 28) {
                // Header
                ZStack {
                    Circle()
                        .fill(Color(hex: "#16a34a").opacity(0.15))
                        .frame(width: 72, height: 72)
                    Image(systemName: "person.2.fill")
                        .font(.system(size: 30))
                        .foregroundStyle(Color(hex: "#22c55e"))
                }
                .padding(.top, 12)

                VStack(spacing: 12) {
                    Text("Ownership Invite")
                        .font(.system(size: 22, weight: .bold))
                        .foregroundStyle(.white)

                    Text(invitingTeamName)
                        .font(.system(size: 16, weight: .semibold))
                        .foregroundStyle(Color(hex: "#22c55e"))

                    Text("is inviting you to join their ownership group")
                        .font(.system(size: 14))
                        .foregroundStyle(Color(hex: "#94a3b8"))
                        .multilineTextAlignment(.center)

                    // Offer details
                    VStack(spacing: 12) {
                        offerRow(
                            icon: "percent",
                            label: "Stake Offered",
                            value: String(format: "%.0f%%", invite.percentageOffered),
                            valueColor: Color(hex: "#22c55e")
                        )
                        Rectangle()
                            .fill(Color.white.opacity(0.06))
                            .frame(height: 1)
                        offerRow(
                            icon: "dollarsign.circle",
                            label: "Your Share Cost",
                            value: CurrencyFormatter.format(cents: invite.amountCents),
                            valueColor: Color(hex: "#eab308")
                        )
                    }
                    .padding(16)
                    .background(Color(hex: "#020617"))
                    .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))

                    if let expires = invite.expiresAt {
                        Label {
                            Text("Expires \(expires.formatted(.relative(presentation: .named)))")
                                .font(.system(size: 12))
                        } icon: {
                            Image(systemName: "clock")
                                .font(.system(size: 12))
                        }
                        .foregroundStyle(Color(hex: "#64748b"))
                    }
                }

                VStack(spacing: 12) {
                    GolfGreenButton("Accept Invite", isLoading: isAccepting) {
                        isAccepting = true
                        await onAccept()
                        HapticManager.shared.notification(.success)
                        dismiss()
                    }

                    GhostButton("Decline") {
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

    private func offerRow(icon: String, label: String, value: String, valueColor: Color) -> some View {
        HStack {
            Image(systemName: icon)
                .font(.system(size: 14))
                .foregroundStyle(Color(hex: "#475569"))
                .frame(width: 20)

            Text(label)
                .font(.system(size: 14))
                .foregroundStyle(Color(hex: "#94a3b8"))

            Spacer()

            Text(value)
                .font(.system(size: 16, weight: .bold))
                .foregroundStyle(valueColor)
        }
    }
}
