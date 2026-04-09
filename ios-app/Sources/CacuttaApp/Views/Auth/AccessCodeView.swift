import SwiftUI

// MARK: - AccessCodeView

struct AccessCodeView: View {
    @StateObject private var viewModel = AuthViewModel()
    @Environment(\.dismiss) private var dismiss
    @FocusState private var isFocused: Bool

    // Hidden text field value for keyboard input
    @State private var hiddenInput = ""
    @State private var currentIndex = 0

    var body: some View {
        ZStack {
            Color(hex: "#020617").ignoresSafeArea()

            VStack(spacing: 0) {
                // Navigation bar
                HStack {
                    Button {
                        dismiss()
                    } label: {
                        Image(systemName: "xmark")
                            .font(.system(size: 16, weight: .semibold))
                            .foregroundStyle(Color(hex: "#94a3b8"))
                            .padding(10)
                            .background(Color.white.opacity(0.06))
                            .clipShape(Circle())
                    }
                    Spacer()
                }
                .padding(.horizontal, 24)
                .padding(.top, 20)

                Spacer()

                VStack(spacing: 36) {
                    // Header
                    VStack(spacing: 10) {
                        Text("Enter Your Code")
                            .font(.system(size: 28, weight: .bold))
                            .foregroundStyle(.white)

                        Text("Your 6-character tournament access code")
                            .font(.system(size: 15))
                            .foregroundStyle(Color(hex: "#94a3b8"))
                            .multilineTextAlignment(.center)
                    }

                    // Code boxes
                    ZStack {
                        // Hidden text field for keyboard
                        TextField("", text: $hiddenInput)
                            .keyboardType(.asciiCapable)
                            .autocorrectionDisabled()
                            .textInputAutocapitalization(.characters)
                            .focused($isFocused)
                            .frame(width: 1, height: 1)
                            .opacity(0.001)
                            .onChange(of: hiddenInput) { _, newValue in
                                handleInput(newValue)
                            }

                        // Visual code boxes
                        HStack(spacing: 10) {
                            ForEach(0..<6, id: \.self) { index in
                                CodeBox(
                                    character: viewModel.codeDigits[index],
                                    isActive: isFocused && activeIndex == index,
                                    hasError: viewModel.errorMessage != nil
                                )
                            }
                        }
                        .offset(x: viewModel.shakeOffset)
                        .onTapGesture {
                            isFocused = true
                        }
                    }

                    // Error message
                    if let error = viewModel.errorMessage {
                        HStack(spacing: 6) {
                            Image(systemName: "exclamationmark.circle.fill")
                                .font(.system(size: 13))
                            Text(error)
                                .font(.system(size: 14))
                        }
                        .foregroundStyle(Color(hex: "#ef4444"))
                        .transition(.scale.combined(with: .opacity))
                    }

                    // Submit button
                    GolfGreenButton(
                        "Join Tournament",
                        isLoading: viewModel.isLoading,
                        isDisabled: !viewModel.isCodeComplete
                    ) {
                        await viewModel.validateCode()
                    }
                    .padding(.horizontal, 28)
                }

                Spacer()
                Spacer()
            }
        }
        .onAppear {
            isFocused = true
        }
        .animation(.spring(response: 0.3), value: viewModel.errorMessage)
    }

    // MARK: - Active Index

    private var activeIndex: Int {
        let filled = viewModel.codeDigits.filter { !$0.isEmpty }.count
        return min(filled, 5)
    }

    // MARK: - Input Handling

    private func handleInput(_ value: String) {
        let filtered = value.uppercased().filter { $0.isLetter || $0.isNumber }
        let chars = Array(filtered)

        // Reset and repopulate
        viewModel.clearCode()
        for (i, char) in chars.prefix(6).enumerated() {
            viewModel.setDigit(String(char), at: i)
        }

        // Keep hidden input in sync (limited to 6)
        let newValue = String(filtered.prefix(6))
        if hiddenInput != newValue {
            hiddenInput = newValue
        }

        // Auto-submit when 6 chars entered
        if newValue.count == 6 {
            HapticManager.shared.digitEntered()
            Task { await viewModel.validateCode() }
        } else if !newValue.isEmpty {
            HapticManager.shared.digitEntered()
        }

        // Clear error on any new input
        if viewModel.errorMessage != nil {
            // error clears via viewmodel binding
        }
    }
}

// MARK: - CodeBox

struct CodeBox: View {
    let character: String
    let isActive: Bool
    let hasError: Bool

    var body: some View {
        ZStack {
            RoundedRectangle(cornerRadius: 12, style: .continuous)
                .fill(Color(hex: "#0f172a"))
                .overlay(
                    RoundedRectangle(cornerRadius: 12, style: .continuous)
                        .stroke(borderColor, lineWidth: 2)
                )

            if character.isEmpty {
                if isActive {
                    BlinkingCursor()
                }
            } else {
                Text(character)
                    .font(.system(size: 24, weight: .bold, design: .monospaced))
                    .foregroundStyle(.white)
            }
        }
        .frame(width: 46, height: 58)
    }

    private var borderColor: Color {
        if hasError { return Color(hex: "#ef4444") }
        if isActive { return Color(hex: "#16a34a") }
        if !character.isEmpty { return Color(hex: "#22c55e").opacity(0.4) }
        return Color.white.opacity(0.1)
    }
}

// MARK: - BlinkingCursor

struct BlinkingCursor: View {
    @State private var visible = true

    var body: some View {
        Rectangle()
            .fill(Color(hex: "#16a34a"))
            .frame(width: 2, height: 24)
            .opacity(visible ? 1 : 0)
            .onAppear {
                withAnimation(.easeInOut(duration: 0.5).repeatForever(autoreverses: true)) {
                    visible = false
                }
            }
    }
}

#Preview {
    AccessCodeView()
}
