import Foundation
import Combine
import SwiftUI

// MARK: - AuthViewModel

@MainActor
final class AuthViewModel: ObservableObject {
    @Published var codeDigits: [String] = Array(repeating: "", count: 6)
    @Published var isLoading = false
    @Published var errorMessage: String?
    @Published var shakeOffset: CGFloat = 0

    private let authService = AuthService.shared
    private var cancellables = Set<AnyCancellable>()

    init() {
        authService.$isLoading
            .assign(to: &$isLoading)
        authService.$error
            .assign(to: &$errorMessage)
    }

    // MARK: - Code Input

    var enteredCode: String {
        codeDigits.joined()
    }

    var isCodeComplete: Bool {
        enteredCode.count == 6
    }

    func setDigit(_ char: String, at index: Int) {
        guard index < 6 else { return }
        let filtered = char.uppercased().filter { $0.isLetter || $0.isNumber }
        codeDigits[index] = String(filtered.prefix(1))
    }

    func deleteDigit(at index: Int) {
        guard index >= 0 && index < 6 else { return }
        codeDigits[index] = ""
    }

    func clearCode() {
        codeDigits = Array(repeating: "", count: 6)
    }

    // MARK: - Validate

    func validateCode() async {
        guard isCodeComplete else { return }
        errorMessage = nil
        await authService.validateAccessCode(enteredCode)
        if authService.error != nil {
            triggerShake()
            clearCode()
        }
    }

    // MARK: - Full Account

    func signIn(email: String, password: String) async {
        await authService.signIn(email: email, password: password)
    }

    func signUp(email: String, password: String) async {
        await authService.signUp(email: email, password: password)
    }

    func signOut() async {
        await authService.signOut()
    }

    // MARK: - Shake Animation

    private func triggerShake() {
        withAnimation(.spring(response: 0.1, dampingFraction: 0.3)) {
            shakeOffset = 10
        }
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.1) {
            withAnimation(.spring(response: 0.1, dampingFraction: 0.3)) {
                self.shakeOffset = -10
            }
        }
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.2) {
            withAnimation(.spring(response: 0.1, dampingFraction: 0.3)) {
                self.shakeOffset = 6
            }
        }
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.3) {
            withAnimation(.spring(response: 0.15, dampingFraction: 0.5)) {
                self.shakeOffset = 0
            }
        }
    }
}
