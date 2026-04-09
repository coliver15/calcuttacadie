import SwiftUI

// MARK: - LoadingView

struct LoadingView: View {
    var message: String = "Loading…"

    var body: some View {
        ZStack {
            Color(hex: "#020617").ignoresSafeArea()

            VStack(spacing: 24) {
                // Golf flag logo mark
                ZStack {
                    Circle()
                        .fill(Color(hex: "#16a34a").opacity(0.15))
                        .frame(width: 80, height: 80)

                    Image(systemName: "flag.fill")
                        .font(.system(size: 32))
                        .foregroundStyle(Color(hex: "#16a34a"))
                }
                .symbolEffect(.bounce, options: .repeating)

                VStack(spacing: 8) {
                    ProgressView()
                        .tint(Color(hex: "#16a34a"))
                        .scaleEffect(1.2)

                    Text(message)
                        .font(.system(size: 15))
                        .foregroundStyle(Color(hex: "#94a3b8"))
                }
            }
        }
    }
}

// MARK: - InlineLoadingView

struct InlineLoadingView: View {
    var body: some View {
        HStack(spacing: 8) {
            ProgressView()
                .tint(Color(hex: "#94a3b8"))
                .scaleEffect(0.8)
            Text("Loading…")
                .font(.system(size: 14))
                .foregroundStyle(Color(hex: "#94a3b8"))
        }
        .frame(maxWidth: .infinity)
        .padding(.vertical, 32)
    }
}

#Preview {
    LoadingView(message: "Connecting to auction…")
}
