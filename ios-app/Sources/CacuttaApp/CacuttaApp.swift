import SwiftUI

// MARK: - CacuttaApp

@main
struct CacuttaApp: App {
    @StateObject private var authService = AuthService.shared

    var body: some Scene {
        WindowGroup {
            RootView()
                .environmentObject(authService)
                .preferredColorScheme(.dark)
        }
    }
}

// MARK: - RootView

struct RootView: View {
    @EnvironmentObject private var authService: AuthService

    var body: some View {
        Group {
            switch authService.authState {
            case .unauthenticated:
                WelcomeView()
                    .transition(.opacity)

            case let .codeAuthenticated(teamId, tournament):
                MainTabView(tournament: tournament, myTeamId: teamId)
                    .transition(.opacity)

            case let .fullAccountAuthenticated(_, tournament):
                if let tournament {
                    // Account user with linked team
                    MainTabView(tournament: tournament, myTeamId: authService.currentTeamId ?? UUID())
                        .transition(.opacity)
                } else {
                    // Account user without linked team — prompt to enter code
                    AccountHomeView()
                        .transition(.opacity)
                }
            }
        }
        .animation(.easeInOut(duration: 0.3), value: authService.authState)
    }
}

// MARK: - AccountHomeView

/// Shown when signed in with a full account but no active tournament/team code linked.
struct AccountHomeView: View {
    @EnvironmentObject private var authService: AuthService
    @State private var showCodeEntry = false

    var body: some View {
        ZStack {
            Color(hex: "#020617").ignoresSafeArea()

            VStack(spacing: 32) {
                Spacer()

                VStack(spacing: 16) {
                    Image(systemName: "person.circle.fill")
                        .font(.system(size: 64))
                        .foregroundStyle(Color(hex: "#22c55e"))

                    VStack(spacing: 8) {
                        Text("Signed In")
                            .font(.system(size: 26, weight: .bold))
                            .foregroundStyle(.white)

                        Text("Enter your tournament access code to join an active auction.")
                            .font(.system(size: 15))
                            .foregroundStyle(Color(hex: "#94a3b8"))
                            .multilineTextAlignment(.center)
                            .padding(.horizontal, 32)
                    }
                }

                Spacer()

                VStack(spacing: 14) {
                    GolfGreenButton("Enter Tournament Code") {
                        showCodeEntry = true
                    }

                    Button {
                        Task { await authService.signOut() }
                    } label: {
                        Text("Sign Out")
                            .font(.system(size: 15))
                            .foregroundStyle(Color(hex: "#94a3b8"))
                    }
                }
                .padding(.horizontal, 28)
                .padding(.bottom, 48)
            }
        }
        .fullScreenCover(isPresented: $showCodeEntry) {
            AccessCodeView()
        }
    }
}
