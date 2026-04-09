import SwiftUI

// MARK: - TournamentInfoView

struct TournamentInfoView: View {
    let tournament: Tournament

    @State private var flights: [Flight] = []
    @State private var flightResults: [FlightResult] = []
    @State private var isLoading = false

    private let tournamentService = TournamentService.shared

    var body: some View {
        NavigationStack {
            ZStack {
                Color(hex: "#020617").ignoresSafeArea()

                if isLoading {
                    LoadingView(message: "Loading tournament…")
                } else {
                    ScrollView {
                        VStack(spacing: 20) {
                            headerCard
                                .padding(.horizontal, 16)
                                .padding(.top, 8)

                            auctionSettingsCard
                                .padding(.horizontal, 16)

                            // Flights
                            if !flights.isEmpty {
                                flightsSection
                                    .padding(.horizontal, 16)
                            }

                            // Results (post-tournament)
                            if tournament.status == .complete && !flightResults.isEmpty {
                                resultsSection
                                    .padding(.horizontal, 16)
                            }

                            Spacer(minLength: 32)
                        }
                    }
                }
            }
            .navigationTitle("Tournament")
            .navigationBarTitleDisplayMode(.large)
            .toolbarBackground(Color(hex: "#020617"), for: .navigationBar)
            .task {
                await loadData()
            }
        }
        .preferredColorScheme(.dark)
    }

    // MARK: - Header Card

    private var headerCard: some View {
        VStack(spacing: 14) {
            VStack(spacing: 6) {
                Text(tournament.name)
                    .font(.system(size: 22, weight: .bold))
                    .foregroundStyle(.white)
                    .multilineTextAlignment(.center)

                HStack(spacing: 6) {
                    Image(systemName: "building.columns.fill")
                        .font(.system(size: 12))
                    Text(tournament.clubName)
                        .font(.system(size: 14))
                }
                .foregroundStyle(Color(hex: "#94a3b8"))

                HStack(spacing: 6) {
                    Image(systemName: "flag.fill")
                        .font(.system(size: 12))
                    Text(tournament.courseName)
                        .font(.system(size: 14))
                }
                .foregroundStyle(Color(hex: "#94a3b8"))
            }

            Rectangle()
                .fill(Color.white.opacity(0.06))
                .frame(height: 1)

            HStack {
                infoChip(
                    icon: "calendar",
                    text: tournament.startDate.formatted(date: .abbreviated, time: .omitted)
                )
                Spacer()
                statusBadge
            }
        }
        .padding(18)
        .background(Color(hex: "#0f172a"))
        .clipShape(RoundedRectangle(cornerRadius: 16, style: .continuous))
        .overlay(
            RoundedRectangle(cornerRadius: 16, style: .continuous)
                .stroke(Color.white.opacity(0.07), lineWidth: 1)
        )
    }

    // MARK: - Auction Settings Card

    private var auctionSettingsCard: some View {
        let settings = tournament.auctionSettings
        return VStack(alignment: .leading, spacing: 14) {
            Text("Auction Rules")
                .font(.system(size: 13, weight: .semibold))
                .foregroundStyle(Color(hex: "#94a3b8"))
                .textCase(.uppercase)
                .tracking(0.8)

            VStack(spacing: 8) {
                StatRow(
                    label: "Opening Bid",
                    value: CurrencyFormatter.format(cents: settings.openingBidCents)
                )
                StatRow(
                    label: "Bid Increment",
                    value: CurrencyFormatter.format(cents: settings.bidIncrementCents)
                )
                StatRow(
                    label: "Timer",
                    value: "\(settings.timerDurationSeconds)s"
                )
                StatRow(
                    label: "Extension",
                    value: "\(settings.extensionDurationSeconds)s if bid within \(settings.extensionThresholdSeconds)s"
                )
                StatRow(
                    label: "Buyback",
                    value: String(format: "%.0f%% of sale", settings.buybackPercentage)
                )
                StatRow(
                    label: "Group Ownership",
                    value: settings.allowGroupOwnership ? "Allowed" : "Disabled",
                    valueColor: settings.allowGroupOwnership ? Color(hex: "#22c55e") : Color(hex: "#94a3b8")
                )
            }
        }
        .padding(16)
        .background(Color(hex: "#0f172a"))
        .clipShape(RoundedRectangle(cornerRadius: 14, style: .continuous))
        .overlay(
            RoundedRectangle(cornerRadius: 14, style: .continuous)
                .stroke(Color.white.opacity(0.06), lineWidth: 1)
        )
    }

    // MARK: - Flights Section

    private var flightsSection: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("Flights & Payouts")
                .font(.system(size: 13, weight: .semibold))
                .foregroundStyle(Color(hex: "#94a3b8"))
                .textCase(.uppercase)
                .tracking(0.8)

            ForEach(flights) { flight in
                VStack(alignment: .leading, spacing: 10) {
                    HStack {
                        Text(flight.name)
                            .font(.system(size: 15, weight: .semibold))
                            .foregroundStyle(.white)
                        Spacer()
                        Text(flight.handicapRange)
                            .font(.system(size: 12))
                            .foregroundStyle(Color(hex: "#94a3b8"))
                    }

                    ForEach(flight.payoutTiers, id: \.place) { tier in
                        HStack {
                            Text(placeString(tier.place))
                                .font(.system(size: 13))
                                .foregroundStyle(Color(hex: "#94a3b8"))
                            if let desc = tier.description {
                                Text(desc)
                                    .font(.system(size: 12))
                                    .foregroundStyle(Color(hex: "#64748b"))
                            }
                            Spacer()
                            CurrencyText(
                                cents: tier.payoutCents,
                                font: .system(size: 14, weight: .semibold),
                                color: Color(hex: "#22c55e")
                            )
                        }
                    }
                }
                .padding(14)
                .background(Color(hex: "#0f172a"))
                .clipShape(RoundedRectangle(cornerRadius: 12))
                .overlay(
                    RoundedRectangle(cornerRadius: 12)
                        .stroke(Color.white.opacity(0.06), lineWidth: 1)
                )
            }
        }
    }

    // MARK: - Results Section

    private var resultsSection: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("Final Results")
                .font(.system(size: 13, weight: .semibold))
                .foregroundStyle(Color(hex: "#94a3b8"))
                .textCase(.uppercase)
                .tracking(0.8)

            ForEach(flights) { flight in
                FlightStandingsView(
                    flight: flight,
                    results: flightResults.filter { $0.flightId == flight.id }
                )
            }
        }
    }

    // MARK: - Helpers

    private var statusBadge: some View {
        let (label, color) = statusInfo
        return Text(label)
            .font(.system(size: 11, weight: .semibold))
            .foregroundStyle(color)
            .padding(.horizontal, 10)
            .padding(.vertical, 4)
            .background(color.opacity(0.12))
            .clipShape(Capsule())
    }

    private var statusInfo: (String, Color) {
        switch tournament.status {
        case .upcoming: return ("Upcoming", Color(hex: "#94a3b8"))
        case .auctionOpen: return ("Auction Open", Color(hex: "#22c55e"))
        case .auctionComplete: return ("Auction Complete", Color(hex: "#eab308"))
        case .inProgress: return ("In Progress", Color(hex: "#3b82f6"))
        case .complete: return ("Complete", Color(hex: "#475569"))
        }
    }

    private func infoChip(icon: String, text: String) -> some View {
        HStack(spacing: 5) {
            Image(systemName: icon)
                .font(.system(size: 11))
            Text(text)
                .font(.system(size: 13))
        }
        .foregroundStyle(Color(hex: "#94a3b8"))
    }

    private func placeString(_ place: Int) -> String {
        let suffix = ["th", "st", "nd", "rd"]
        let remainder = place % 100
        if remainder >= 11 && remainder <= 13 { return "\(place)th Place" }
        return "\(place)\(suffix[min(place % 10, 3)]) Place"
    }

    private func loadData() async {
        isLoading = true
        defer { isLoading = false }
        do {
            async let flightsTask = tournamentService.fetchFlights(tournamentId: tournament.id)
            let fetchedFlights = try await flightsTask
            flights = fetchedFlights

            if tournament.status == .complete {
                flightResults = try await tournamentService.fetchFlightResults(tournamentId: tournament.id)
            }
        } catch {
            // Non-critical: flights may not be configured
        }
    }
}
