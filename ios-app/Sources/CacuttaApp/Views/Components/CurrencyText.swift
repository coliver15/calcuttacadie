import SwiftUI

// MARK: - CurrencyText

/// Displays a cents value formatted as "$X,XXX" with customizable styling.
struct CurrencyText: View {
    let cents: Int
    var font: Font = .system(size: 17, weight: .semibold)
    var color: Color = .white
    var showCents: Bool = false

    var body: some View {
        Text(formatted)
            .font(font)
            .foregroundStyle(color)
            .monospacedDigit()
    }

    private var formatted: String {
        let dollars = Double(cents) / 100.0
        if showCents {
            return NumberFormatter.currencyWithCents.string(from: NSNumber(value: dollars)) ?? "$0.00"
        }
        return NumberFormatter.currency.string(from: NSNumber(value: dollars)) ?? "$0"
    }
}

// MARK: - Number Formatter Extensions

extension NumberFormatter {
    static let currencyWithCents: NumberFormatter = {
        let f = NumberFormatter()
        f.numberStyle = .currency
        f.maximumFractionDigits = 2
        f.minimumFractionDigits = 2
        return f
    }()
}

// MARK: - Dollar String

extension Int {
    /// Converts a cents value to a dollar string like "$1,250".
    var dollarString: String {
        CurrencyFormatter.format(cents: self)
    }
}

#Preview {
    VStack(spacing: 12) {
        CurrencyText(cents: 125000, font: .system(size: 34, weight: .bold), color: Color(hex: "#22c55e"))
        CurrencyText(cents: 5000)
        CurrencyText(cents: 0)
    }
    .padding()
    .background(Color(hex: "#020617"))
}
