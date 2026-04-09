import SwiftUI

// MARK: - AllTeamsListView

struct AllTeamsListView: View {
    let teams: [Team]
    let sessions: [AuctionSession]
    let myTeamId: UUID?

    var body: some View {
        ScrollView {
            LazyVStack(spacing: 0) {
                ForEach(teams) { team in
                    TeamRowView(
                        team: team,
                        session: session(for: team),
                        isMyTeam: team.id == myTeamId
                    )
                    Rectangle()
                        .fill(Color.white.opacity(0.04))
                        .frame(height: 1)
                        .padding(.horizontal, 16)
                }
            }
        }
        .background(Color(hex: "#020617"))
    }

    private func session(for team: Team) -> AuctionSession? {
        sessions.first(where: { $0.teamId == team.id })
    }
}

#Preview {
    AllTeamsListView(teams: [], sessions: [], myTeamId: nil)
}
