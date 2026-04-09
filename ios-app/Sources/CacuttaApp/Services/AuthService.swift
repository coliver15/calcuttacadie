import Foundation
import Supabase

// MARK: - Access Code Validation Response

struct AccessCodeResponse: Decodable {
    let token: String
    let team: TeamWithTournament
}

struct TeamWithTournament: Decodable {
    let id: UUID
    let player1Name: String
    let player2Name: String
    let tournament: Tournament

    enum CodingKeys: String, CodingKey {
        case id
        case player1Name = "player1_name"
        case player2Name = "player2_name"
        case tournament
    }
}

// MARK: - Auth State

enum AuthState: Equatable {
    case unauthenticated
    case codeAuthenticated(teamId: UUID, tournament: Tournament)
    case fullAccountAuthenticated(userId: UUID, tournament: Tournament?)
}

// MARK: - AuthService

@MainActor
final class AuthService: ObservableObject {
    static let shared = AuthService()

    @Published private(set) var authState: AuthState = .unauthenticated
    @Published private(set) var currentTeam: TeamWithTournament?
    @Published private(set) var isLoading = false
    @Published private(set) var error: String?

    private let supabase = SupabaseService.shared
    private let keychain = KeychainHelper.shared

    private init() {
        restoreSession()
    }

    // MARK: - Restore Session

    private func restoreSession() {
        guard let token = keychain.retrieve(key: KeychainHelper.tokenKey),
              let teamId = keychain.retrieveUUID(key: KeychainHelper.teamIdKey),
              let tournamentData = keychain.retrieveData(key: KeychainHelper.tournamentKey),
              let tournament = try? JSONDecoder.iso8601Full.decode(Tournament.self, from: tournamentData)
        else { return }
        // Validate token not expired
        if JWTHelper.isExpired(token) {
            clearSession()
            return
        }
        authState = .codeAuthenticated(teamId: teamId, tournament: tournament)
    }

    // MARK: - Access Code Login

    func validateAccessCode(_ code: String) async {
        isLoading = true
        error = nil
        defer { isLoading = false }

        let url = AppConfig.edgeFunctionBaseURL.appendingPathComponent("validate-access-code")
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")

        let body = ["access_code": code.uppercased()]
        request.httpBody = try? JSONEncoder().encode(body)

        do {
            let (data, response) = try await URLSession.shared.data(for: request)
            guard let httpResponse = response as? HTTPURLResponse else {
                throw APIError.invalidResponse
            }
            guard (200...299).contains(httpResponse.statusCode) else {
                if httpResponse.statusCode == 401 || httpResponse.statusCode == 404 {
                    throw AuthError.invalidCode
                }
                throw APIError.httpError(statusCode: httpResponse.statusCode, message: "")
            }
            let result = try JSONDecoder.iso8601Full.decode(AccessCodeResponse.self, from: data)
            await saveSession(token: result.token, team: result.team)
        } catch let authErr as AuthError {
            error = authErr.localizedDescription
        } catch {
            self.error = error.localizedDescription
        }
    }

    // MARK: - Full Account Login

    func signIn(email: String, password: String) async {
        isLoading = true
        error = nil
        defer { isLoading = false }
        do {
            let session = try await supabase.client.auth.signIn(
                email: email,
                password: password
            )
            keychain.store(
                key: KeychainHelper.accountTokenKey,
                value: session.accessToken
            )
            authState = .fullAccountAuthenticated(userId: session.user.id, tournament: nil)
        } catch {
            self.error = error.localizedDescription
        }
    }

    func signUp(email: String, password: String) async {
        isLoading = true
        error = nil
        defer { isLoading = false }
        do {
            let session = try await supabase.client.auth.signUp(
                email: email,
                password: password
            )
            if let accessToken = session.session?.accessToken {
                keychain.store(key: KeychainHelper.accountTokenKey, value: accessToken)
            }
            if let sess = session.session {
                authState = .fullAccountAuthenticated(userId: sess.user.id, tournament: nil)
            }
        } catch {
            self.error = error.localizedDescription
        }
    }

    func signOut() async {
        clearSession()
        try? await supabase.client.auth.signOut()
    }

    // MARK: - Link Team Code to Account

    func linkTeamCode(_ code: String) async {
        // Re-validate code while authenticated with account to link it
        await validateAccessCode(code)
    }

    // MARK: - Session Management

    private func saveSession(token: String, team: TeamWithTournament) async {
        keychain.store(key: KeychainHelper.tokenKey, value: token)
        keychain.storeUUID(key: KeychainHelper.teamIdKey, value: team.id)
        if let tournamentData = try? JSONEncoder.iso8601Full.encode(team.tournament) {
            keychain.storeData(key: KeychainHelper.tournamentKey, data: tournamentData)
        }
        currentTeam = team
        authState = .codeAuthenticated(teamId: team.id, tournament: team.tournament)
    }

    private func clearSession() {
        keychain.delete(key: KeychainHelper.tokenKey)
        keychain.delete(key: KeychainHelper.teamIdKey)
        keychain.delete(key: KeychainHelper.tournamentKey)
        keychain.delete(key: KeychainHelper.accountTokenKey)
        currentTeam = nil
        authState = .unauthenticated
    }

    // MARK: - Helpers

    var currentTeamId: UUID? {
        if case let .codeAuthenticated(teamId, _) = authState { return teamId }
        return nil
    }

    var currentTournament: Tournament? {
        switch authState {
        case let .codeAuthenticated(_, tournament): return tournament
        case let .fullAccountAuthenticated(_, tournament): return tournament
        default: return nil
        }
    }
}

// MARK: - Auth Errors

enum AuthError: LocalizedError {
    case invalidCode
    case sessionExpired
    case networkError

    var errorDescription: String? {
        switch self {
        case .invalidCode: return "Invalid access code. Please check and try again."
        case .sessionExpired: return "Your session has expired. Please re-enter your code."
        case .networkError: return "Network error. Please check your connection."
        }
    }
}

// MARK: - JWT Helper

enum JWTHelper {
    static func isExpired(_ token: String) -> Bool {
        let parts = token.split(separator: ".")
        guard parts.count == 3 else { return true }
        var base64 = String(parts[1])
        // Pad base64 string
        let remainder = base64.count % 4
        if remainder > 0 { base64 += String(repeating: "=", count: 4 - remainder) }
        guard let data = Data(base64Encoded: base64),
              let json = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
              let exp = json["exp"] as? TimeInterval else { return true }
        return Date(timeIntervalSince1970: exp) < Date()
    }
}
