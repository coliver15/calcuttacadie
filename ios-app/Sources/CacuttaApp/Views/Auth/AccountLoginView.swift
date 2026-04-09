import SwiftUI

// MARK: - AccountLoginView

struct AccountLoginView: View {
    @StateObject private var viewModel = AuthViewModel()
    @Environment(\.dismiss) private var dismiss

    @State private var email = ""
    @State private var password = ""
    @State private var isSignUp = false
    @FocusState private var focusedField: Field?

    enum Field { case email, password }

    var body: some View {
        NavigationStack {
            ZStack {
                Color(hex: "#020617").ignoresSafeArea()

                ScrollView {
                    VStack(spacing: 32) {
                        // Header
                        VStack(spacing: 10) {
                            Image(systemName: "person.circle.fill")
                                .font(.system(size: 48))
                                .foregroundStyle(Color(hex: "#16a34a"))
                                .padding(.top, 20)

                            Text(isSignUp ? "Create Account" : "Sign In")
                                .font(.system(size: 26, weight: .bold))
                                .foregroundStyle(.white)

                            Text(isSignUp
                                 ? "Create an account to track your stats across tournaments"
                                 : "Sign in to access your historical stats and linked teams")
                                .font(.system(size: 14))
                                .foregroundStyle(Color(hex: "#94a3b8"))
                                .multilineTextAlignment(.center)
                                .padding(.horizontal, 16)
                        }

                        // Form
                        VStack(spacing: 14) {
                            // Email field
                            VStack(alignment: .leading, spacing: 8) {
                                Text("Email")
                                    .font(.system(size: 13, weight: .medium))
                                    .foregroundStyle(Color(hex: "#94a3b8"))

                                TextField("your@email.com", text: $email)
                                    .keyboardType(.emailAddress)
                                    .autocorrectionDisabled()
                                    .textInputAutocapitalization(.never)
                                    .focused($focusedField, equals: .email)
                                    .submitLabel(.next)
                                    .onSubmit { focusedField = .password }
                                    .padding(.horizontal, 16)
                                    .padding(.vertical, 14)
                                    .background(Color(hex: "#0f172a"))
                                    .clipShape(RoundedRectangle(cornerRadius: 12))
                                    .overlay(
                                        RoundedRectangle(cornerRadius: 12)
                                            .stroke(
                                                focusedField == .email
                                                    ? Color(hex: "#16a34a")
                                                    : Color.white.opacity(0.08),
                                                lineWidth: 1.5
                                            )
                                    )
                                    .foregroundStyle(.white)
                            }

                            // Password field
                            VStack(alignment: .leading, spacing: 8) {
                                Text("Password")
                                    .font(.system(size: 13, weight: .medium))
                                    .foregroundStyle(Color(hex: "#94a3b8"))

                                SecureField("••••••••", text: $password)
                                    .focused($focusedField, equals: .password)
                                    .submitLabel(.go)
                                    .onSubmit { Task { await submit() } }
                                    .padding(.horizontal, 16)
                                    .padding(.vertical, 14)
                                    .background(Color(hex: "#0f172a"))
                                    .clipShape(RoundedRectangle(cornerRadius: 12))
                                    .overlay(
                                        RoundedRectangle(cornerRadius: 12)
                                            .stroke(
                                                focusedField == .password
                                                    ? Color(hex: "#16a34a")
                                                    : Color.white.opacity(0.08),
                                                lineWidth: 1.5
                                            )
                                    )
                                    .foregroundStyle(.white)
                            }

                            // Error
                            if let error = viewModel.errorMessage {
                                HStack(spacing: 6) {
                                    Image(systemName: "exclamationmark.circle.fill")
                                        .font(.system(size: 13))
                                    Text(error)
                                        .font(.system(size: 13))
                                }
                                .foregroundStyle(Color(hex: "#ef4444"))
                            }
                        }
                        .padding(.horizontal, 28)

                        // Submit
                        VStack(spacing: 16) {
                            GolfGreenButton(
                                isSignUp ? "Create Account" : "Sign In",
                                isLoading: viewModel.isLoading,
                                isDisabled: !canSubmit
                            ) {
                                await submit()
                            }
                            .padding(.horizontal, 28)

                            // Toggle mode
                            Button {
                                withAnimation(.easeInOut(duration: 0.2)) {
                                    isSignUp.toggle()
                                    viewModel.errorMessage = nil
                                }
                            } label: {
                                HStack(spacing: 4) {
                                    Text(isSignUp ? "Already have an account?" : "Don't have an account?")
                                        .font(.system(size: 14))
                                        .foregroundStyle(Color(hex: "#94a3b8"))
                                    Text(isSignUp ? "Sign In" : "Create one")
                                        .font(.system(size: 14, weight: .semibold))
                                        .foregroundStyle(Color(hex: "#22c55e"))
                                }
                            }

                            // Divider
                            HStack {
                                Rectangle().fill(Color.white.opacity(0.06)).frame(height: 1)
                                Text("Note").font(.system(size: 11)).foregroundStyle(Color(hex: "#475569"))
                                Rectangle().fill(Color.white.opacity(0.06)).frame(height: 1)
                            }
                            .padding(.horizontal, 28)

                            Text("An account is optional. You can join tournaments using just your 6-character access code.")
                                .font(.system(size: 12))
                                .foregroundStyle(Color(hex: "#64748b"))
                                .multilineTextAlignment(.center)
                                .padding(.horizontal, 40)
                                .padding(.bottom, 32)
                        }
                    }
                }
            }
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") { dismiss() }
                        .foregroundStyle(Color(hex: "#94a3b8"))
                }
            }
        }
        .preferredColorScheme(.dark)
    }

    private var canSubmit: Bool {
        !email.isEmpty && password.count >= 6
    }

    private func submit() async {
        focusedField = nil
        if isSignUp {
            await viewModel.signUp(email: email, password: password)
        } else {
            await viewModel.signIn(email: email, password: password)
        }
    }
}

#Preview {
    AccountLoginView()
}
