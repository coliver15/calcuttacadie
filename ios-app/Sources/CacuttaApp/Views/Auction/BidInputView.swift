import SwiftUI

// MARK: - BidInputView

struct BidInputView: View {
    @EnvironmentObject private var viewModel: AuctionViewModel
    @Environment(\.dismiss) private var dismiss

    @State private var bidAmountCents: Int = 0
    @State private var inputString: String = ""

    var body: some View {
        NavigationStack {
            ZStack {
                Color(hex: "#020617").ignoresSafeArea()

                VStack(spacing: 0) {
                    // Current high bid info
                    if let session = viewModel.currentSession {
                        VStack(spacing: 8) {
                            if let highBid = session.currentHighBidCents {
                                HStack {
                                    VStack(alignment: .leading, spacing: 2) {
                                        Text("Current High Bid")
                                            .font(.system(size: 11, weight: .medium))
                                            .foregroundStyle(Color(hex: "#64748b"))
                                            .textCase(.uppercase)
                                            .tracking(0.5)
                                        CurrencyText(
                                            cents: highBid,
                                            font: .system(size: 22, weight: .bold),
                                            color: Color(hex: "#94a3b8")
                                        )
                                    }
                                    Spacer()
                                    VStack(alignment: .trailing, spacing: 2) {
                                        Text("Minimum Bid")
                                            .font(.system(size: 11, weight: .medium))
                                            .foregroundStyle(Color(hex: "#64748b"))
                                            .textCase(.uppercase)
                                            .tracking(0.5)
                                        CurrencyText(
                                            cents: viewModel.minimumNextBidCents,
                                            font: .system(size: 22, weight: .bold),
                                            color: Color(hex: "#22c55e")
                                        )
                                    }
                                }
                            } else {
                                HStack {
                                    Text("Opening Bid")
                                        .font(.system(size: 13))
                                        .foregroundStyle(Color(hex: "#94a3b8"))
                                    Spacer()
                                    CurrencyText(
                                        cents: session.openingBidCents,
                                        font: .system(size: 20, weight: .bold),
                                        color: Color(hex: "#22c55e")
                                    )
                                }
                            }
                        }
                        .padding(20)
                        .background(Color(hex: "#0f172a"))
                        .clipShape(RoundedRectangle(cornerRadius: 14, style: .continuous))
                        .padding(.horizontal, 20)
                        .padding(.top, 8)
                    }

                    // Bid amount display
                    VStack(spacing: 4) {
                        Text("Your Bid")
                            .font(.system(size: 13, weight: .medium))
                            .foregroundStyle(Color(hex: "#64748b"))
                            .textCase(.uppercase)
                            .tracking(0.5)

                        Text(bidDisplayString)
                            .font(.system(size: 48, weight: .black, design: .rounded))
                            .foregroundStyle(isValidBid ? Color(hex: "#22c55e") : .white)
                            .monospacedDigit()
                            .minimumScaleFactor(0.6)
                            .lineLimit(1)
                            .padding(.horizontal, 20)
                    }
                    .padding(.vertical, 24)

                    // Error
                    if let error = viewModel.bidError {
                        Text(error)
                            .font(.system(size: 13))
                            .foregroundStyle(Color(hex: "#ef4444"))
                            .padding(.horizontal, 20)
                            .padding(.bottom, 8)
                    }

                    // Numeric Keypad
                    NumericKeypad { key in
                        handleKeyPress(key)
                    }
                    .padding(.horizontal, 20)

                    Spacer(minLength: 16)

                    // Confirm button
                    GolfGreenButton(
                        isValidBid ? "Bid \(bidDisplayString)" : "Enter an Amount",
                        isLoading: viewModel.isBidSubmitting,
                        isDisabled: !isValidBid
                    ) {
                        await viewModel.placeBid(amountCents: bidAmountCents)
                    }
                    .padding(.horizontal, 20)
                    .padding(.bottom, 24)
                }
            }
            .navigationTitle(viewModel.currentTeam?.displayName ?? "Place Bid")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") { dismiss() }
                        .foregroundStyle(Color(hex: "#94a3b8"))
                }
            }
        }
        .preferredColorScheme(.dark)
        .onAppear {
            // Pre-fill minimum bid
            bidAmountCents = viewModel.minimumNextBidCents
            inputString = String(viewModel.minimumNextBidCents / 100)
        }
    }

    // MARK: - Computed

    private var isValidBid: Bool {
        bidAmountCents >= viewModel.minimumNextBidCents && bidAmountCents > 0
    }

    private var bidDisplayString: String {
        guard bidAmountCents > 0 else { return "$—" }
        return CurrencyFormatter.format(cents: bidAmountCents)
    }

    // MARK: - Keypad Handling

    private func handleKeyPress(_ key: KeypadKey) {
        switch key {
        case .digit(let d):
            if inputString == "0" {
                inputString = d
            } else {
                let next = inputString + d
                if let val = Int(next), val <= 999_999 {
                    inputString = next
                }
            }
        case .delete:
            if inputString.count > 1 {
                inputString.removeLast()
            } else {
                inputString = "0"
            }
        case .clear:
            inputString = "0"
        }
        bidAmountCents = (Int(inputString) ?? 0) * 100
        HapticManager.shared.selectionChanged()
    }
}

// MARK: - Numeric Keypad

enum KeypadKey {
    case digit(String)
    case delete
    case clear
}

struct NumericKeypad: View {
    let onKey: (KeypadKey) -> Void

    private let keys: [[String]] = [
        ["1", "2", "3"],
        ["4", "5", "6"],
        ["7", "8", "9"],
        ["CLR", "0", "⌫"]
    ]

    var body: some View {
        VStack(spacing: 10) {
            ForEach(keys, id: \.self) { row in
                HStack(spacing: 10) {
                    ForEach(row, id: \.self) { key in
                        Button {
                            onKey(keypadKey(from: key))
                            HapticManager.shared.selectionChanged()
                        } label: {
                            ZStack {
                                RoundedRectangle(cornerRadius: 12, style: .continuous)
                                    .fill(Color(hex: "#0f172a"))

                                if key == "⌫" {
                                    Image(systemName: "delete.backward")
                                        .font(.system(size: 18, weight: .medium))
                                        .foregroundStyle(.white)
                                } else if key == "CLR" {
                                    Text("CLR")
                                        .font(.system(size: 14, weight: .semibold))
                                        .foregroundStyle(Color(hex: "#94a3b8"))
                                } else {
                                    Text(key)
                                        .font(.system(size: 24, weight: .semibold))
                                        .foregroundStyle(.white)
                                }
                            }
                            .frame(maxWidth: .infinity)
                            .frame(height: 60)
                        }
                        .buttonStyle(ScaleButtonStyle())
                    }
                }
            }
        }
    }

    private func keypadKey(from string: String) -> KeypadKey {
        switch string {
        case "⌫": return .delete
        case "CLR": return .clear
        default: return .digit(string)
        }
    }
}
