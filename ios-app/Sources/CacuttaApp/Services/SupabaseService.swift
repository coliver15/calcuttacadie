import Foundation
import Supabase

// MARK: - App Configuration

enum AppConfig {
    /// Read from Info.plist key SUPABASE_URL. Add to your target's Info.plist.
    static var supabaseURL: URL {
        guard let urlString = Bundle.main.infoDictionary?["SUPABASE_URL"] as? String,
              let url = URL(string: urlString) else {
            fatalError("SUPABASE_URL not set in Info.plist")
        }
        return url
    }

    /// Read from Info.plist key SUPABASE_ANON_KEY.
    static var supabaseAnonKey: String {
        guard let key = Bundle.main.infoDictionary?["SUPABASE_ANON_KEY"] as? String else {
            fatalError("SUPABASE_ANON_KEY not set in Info.plist")
        }
        return key
    }

    /// Edge Function base URL (same origin as Supabase by convention).
    static var edgeFunctionBaseURL: URL {
        supabaseURL.appendingPathComponent("functions/v1")
    }
}

// MARK: - SupabaseService

@MainActor
final class SupabaseService: ObservableObject {
    static let shared = SupabaseService()

    let client: SupabaseClient

    private init() {
        client = SupabaseClient(
            supabaseURL: AppConfig.supabaseURL,
            supabaseKey: AppConfig.supabaseAnonKey
        )
    }

    // MARK: - Authenticated URL Requests

    /// Builds a URLRequest with the stored Bearer token applied.
    func authenticatedRequest(
        url: URL,
        method: String = "GET",
        body: Data? = nil
    ) -> URLRequest {
        var request = URLRequest(url: url)
        request.httpMethod = method
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        if let token = KeychainHelper.shared.retrieve(key: KeychainHelper.tokenKey) {
            request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        }
        request.httpBody = body
        return request
    }

    /// Performs an authenticated JSON request and decodes the response.
    func perform<T: Decodable>(
        _ request: URLRequest,
        as type: T.Type
    ) async throws -> T {
        let (data, response) = try await URLSession.shared.data(for: request)
        guard let httpResponse = response as? HTTPURLResponse else {
            throw APIError.invalidResponse
        }
        guard (200...299).contains(httpResponse.statusCode) else {
            let message = String(data: data, encoding: .utf8) ?? "Unknown error"
            throw APIError.httpError(statusCode: httpResponse.statusCode, message: message)
        }
        return try JSONDecoder.iso8601Full.decode(T.self, from: data)
    }
}

// MARK: - API Error

enum APIError: LocalizedError {
    case invalidResponse
    case httpError(statusCode: Int, message: String)
    case decodingError(String)
    case unauthorized

    var errorDescription: String? {
        switch self {
        case .invalidResponse:
            return "Invalid server response."
        case let .httpError(code, msg):
            return "Server error \(code): \(msg)"
        case let .decodingError(detail):
            return "Data error: \(detail)"
        case .unauthorized:
            return "You are not authorized. Please re-enter your access code."
        }
    }
}

// MARK: - JSON Decoder

extension JSONDecoder {
    static let iso8601Full: JSONDecoder = {
        let decoder = JSONDecoder()
        let formatter = ISO8601DateFormatter()
        formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        decoder.dateDecodingStrategy = .custom { dec in
            let container = try dec.singleValueContainer()
            let string = try container.decode(String.self)
            if let date = formatter.date(from: string) { return date }
            // Fallback without fractional seconds
            let fallback = ISO8601DateFormatter()
            if let date = fallback.date(from: string) { return date }
            throw DecodingError.dataCorruptedError(
                in: container,
                debugDescription: "Cannot decode date: \(string)"
            )
        }
        return decoder
    }()
}

extension JSONEncoder {
    static let iso8601Full: JSONEncoder = {
        let encoder = JSONEncoder()
        let formatter = ISO8601DateFormatter()
        formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        encoder.dateEncodingStrategy = .custom { date, enc in
            var container = enc.singleValueContainer()
            try container.encode(formatter.string(from: date))
        }
        return encoder
    }()
}
