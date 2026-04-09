import Foundation

// MARK: - HistoricalStatsViewModel

@MainActor
final class HistoricalStatsViewModel: ObservableObject {

    @Published private(set) var stats: HistoricalStats?
    @Published private(set) var isLoading = false
    @Published private(set) var errorMessage: String?

    private let tournamentService = TournamentService.shared

    // MARK: - Fetch

    func fetchStats(player1Name: String, player2Name: String) async {
        isLoading = true
        errorMessage = nil
        stats = nil
        defer { isLoading = false }
        do {
            stats = try await tournamentService.fetchHistoricalStats(
                player1Name: player1Name,
                player2Name: player2Name
            )
        } catch {
            errorMessage = "No historical data found for this pairing."
        }
    }

    // MARK: - Formatted Stats

    var winRateString: String {
        guard let s = stats, s.calcuttasEntered > 0 else { return "—" }
        let rate = Double(s.wins) / Double(s.calcuttasEntered) * 100
        return String(format: "%.0f%%", rate)
    }

    var avgSalePriceString: String {
        guard let price = stats?.avgSalePriceCents else { return "—" }
        return CurrencyFormatter.format(cents: price)
    }

    var avgFinishString: String {
        guard let finish = stats?.avgFinish else { return "—" }
        return String(format: "%.1f", finish)
    }

    var totalEarningsString: String {
        guard let s = stats else { return "—" }
        return CurrencyFormatter.format(cents: s.totalEarningsCents)
    }

    var avgNetScoreString: String {
        guard let score = stats?.avgNetScore else { return "—" }
        return String(format: "%.1f", score)
    }

    var top3RateString: String {
        guard let s = stats, s.calcuttasEntered > 0 else { return "—" }
        let rate = Double(s.top3Finishes) / Double(s.calcuttasEntered) * 100
        return String(format: "%.0f%%", rate)
    }
}
