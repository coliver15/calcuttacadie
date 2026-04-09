import SwiftUI

// MARK: - WelcomeView

struct WelcomeView: View {
    @State private var showAccessCode = false
    @State private var showAccountLogin = false

    var body: some View {
        ZStack {
            // Background gradient
            LinearGradient(
                colors: [
                    Color(hex: "#020617"),
                    Color(hex: "#052e16").opacity(0.5),
                    Color(hex: "#020617")
                ],
                startPoint: .topLeading,
                endPoint: .bottomTrailing
            )
            .ignoresSafeArea()

            VStack(spacing: 0) {
                Spacer()

                // Logo mark
                VStack(spacing: 20) {
                    ZStack {
                        Circle()
                            .fill(Color(hex: "#16a34a").opacity(0.2))
                            .frame(width: 100, height: 100)

                        Circle()
                            .fill(Color(hex: "#16a34a").opacity(0.1))
                            .frame(width: 130, height: 130)

                        Image(systemName: "flag.fill")
                            .font(.system(size: 44))
                            .foregroundStyle(Color(hex: "#22c55e"))
                    }

                    VStack(spacing: 8) {
                        Text("Calcutta")
                            .font(.system(size: 38, weight: .black, design: .rounded))
                            .foregroundStyle(.white)
                            .tracking(-0.5)

                        Text("Golf Auction Platform")
                            .font(.system(size: 15, weight: .medium))
                            .foregroundStyle(Color(hex: "#94a3b8"))
                            .tracking(1.2)
                            .textCase(.uppercase)
                    }
                }

                Spacer()

                // CTA Section
                VStack(spacing: 14) {
                    Text("Join your tournament")
                        .font(.system(size: 13, weight: .medium))
                        .foregroundStyle(Color(hex: "#64748b"))
                        .textCase(.uppercase)
                        .tracking(1)

                    GolfGreenButton("Enter Access Code") {
                        showAccessCode = true
                    }

                    HStack {
                        Rectangle()
                            .fill(Color.white.opacity(0.08))
                            .frame(height: 1)

                        Text("or")
                            .font(.system(size: 13))
                            .foregroundStyle(Color(hex: "#475569"))
                            .padding(.horizontal, 12)

                        Rectangle()
                            .fill(Color.white.opacity(0.08))
                            .frame(height: 1)
                    }

                    Button {
                        showAccountLogin = true
                    } label: {
                        Text("Sign in with Account")
                            .font(.system(size: 16, weight: .medium))
                            .foregroundStyle(Color(hex: "#94a3b8"))
                            .frame(maxWidth: .infinity)
                            .frame(height: 50)
                    }
                }
                .padding(.horizontal, 28)
                .padding(.bottom, 48)
            }
        }
        .fullScreenCover(isPresented: $showAccessCode) {
            AccessCodeView()
        }
        .sheet(isPresented: $showAccountLogin) {
            AccountLoginView()
        }
    }
}

#Preview {
    WelcomeView()
}
