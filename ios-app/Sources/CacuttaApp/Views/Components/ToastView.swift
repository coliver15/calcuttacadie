import SwiftUI

// MARK: - ToastView

struct ToastView: View {
    let toast: ToastMessage
    let onDismiss: () -> Void

    var body: some View {
        HStack(spacing: 12) {
            // Icon
            Image(systemName: iconName)
                .font(.system(size: 16, weight: .semibold))
                .foregroundStyle(iconColor)
                .frame(width: 24)

            VStack(alignment: .leading, spacing: 2) {
                Text(toast.message)
                    .font(.system(size: 14, weight: .medium))
                    .foregroundStyle(.white)
                    .lineLimit(2)
            }

            Spacer(minLength: 0)

            if let actionLabel = toast.actionLabel, let action = toast.action {
                Button {
                    action()
                    onDismiss()
                } label: {
                    Text(actionLabel)
                        .font(.system(size: 13, weight: .semibold))
                        .foregroundStyle(iconColor)
                        .padding(.horizontal, 10)
                        .padding(.vertical, 6)
                        .background(iconColor.opacity(0.15))
                        .clipShape(Capsule())
                }
            }

            Button {
                onDismiss()
            } label: {
                Image(systemName: "xmark")
                    .font(.system(size: 11, weight: .bold))
                    .foregroundStyle(Color(hex: "#64748b"))
                    .padding(6)
            }
        }
        .padding(.horizontal, 16)
        .padding(.vertical, 12)
        .background(
            RoundedRectangle(cornerRadius: 14, style: .continuous)
                .fill(Color(hex: "#1e293b"))
                .shadow(color: .black.opacity(0.4), radius: 16, y: 6)
        )
        .overlay(
            RoundedRectangle(cornerRadius: 14, style: .continuous)
                .stroke(iconColor.opacity(0.25), lineWidth: 1)
        )
    }

    private var iconName: String {
        switch toast.type {
        case .outbid: return "arrow.up.circle.fill"
        case .invite: return "person.2.fill"
        case .sold: return "checkmark.seal.fill"
        case .info: return "info.circle.fill"
        }
    }

    private var iconColor: Color {
        switch toast.type {
        case .outbid: return Color(hex: "#ef4444")
        case .invite: return Color(hex: "#22c55e")
        case .sold: return Color(hex: "#eab308")
        case .info: return Color(hex: "#94a3b8")
        }
    }
}

// MARK: - Toast Modifier

struct ToastModifier: ViewModifier {
    @Binding var toast: ToastMessage?

    func body(content: Content) -> some View {
        ZStack(alignment: .top) {
            content

            if let toast {
                ToastView(toast: toast) {
                    withAnimation(.easeInOut(duration: 0.25)) {
                        self.toast = nil
                    }
                }
                .padding(.horizontal, 16)
                .padding(.top, 8)
                .transition(
                    .asymmetric(
                        insertion: .move(edge: .top).combined(with: .opacity),
                        removal: .move(edge: .top).combined(with: .opacity)
                    )
                )
                .zIndex(999)
                .onAppear {
                    DispatchQueue.main.asyncAfter(deadline: .now() + 4.0) {
                        withAnimation(.easeInOut(duration: 0.25)) {
                            if self.toast?.id == toast.id {
                                self.toast = nil
                            }
                        }
                    }
                }
            }
        }
        .animation(.spring(response: 0.35, dampingFraction: 0.8), value: toast)
    }
}

extension View {
    func toastOverlay(toast: Binding<ToastMessage?>) -> some View {
        modifier(ToastModifier(toast: toast))
    }
}
