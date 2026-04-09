import Foundation
import Security

// MARK: - KeychainHelper

final class KeychainHelper {
    static let shared = KeychainHelper()

    // MARK: - Keys

    static let tokenKey = "com.calcutta.auth.token"
    static let teamIdKey = "com.calcutta.auth.teamId"
    static let tournamentKey = "com.calcutta.auth.tournament"
    static let accountTokenKey = "com.calcutta.auth.accountToken"

    private let service = "com.calcutta.app"

    private init() {}

    // MARK: - Store String

    @discardableResult
    func store(key: String, value: String) -> Bool {
        guard let data = value.data(using: .utf8) else { return false }
        return storeData(key: key, data: data)
    }

    // MARK: - Retrieve String

    func retrieve(key: String) -> String? {
        guard let data = retrieveData(key: key) else { return nil }
        return String(data: data, encoding: .utf8)
    }

    // MARK: - Store Data

    @discardableResult
    func storeData(key: String, data: Data) -> Bool {
        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: key
        ]
        let attributes: [String: Any] = [
            kSecValueData as String: data
        ]
        // Try update first
        let updateStatus = SecItemUpdate(query as CFDictionary, attributes as CFDictionary)
        if updateStatus == errSecSuccess { return true }

        // Add new item
        var addQuery = query
        addQuery[kSecValueData as String] = data
        addQuery[kSecAttrAccessible as String] = kSecAttrAccessibleAfterFirstUnlock
        let addStatus = SecItemAdd(addQuery as CFDictionary, nil)
        return addStatus == errSecSuccess
    }

    // MARK: - Retrieve Data

    func retrieveData(key: String) -> Data? {
        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: key,
            kSecReturnData as String: true,
            kSecMatchLimit as String: kSecMatchLimitOne
        ]
        var result: AnyObject?
        let status = SecItemCopyMatching(query as CFDictionary, &result)
        guard status == errSecSuccess else { return nil }
        return result as? Data
    }

    // MARK: - Delete

    @discardableResult
    func delete(key: String) -> Bool {
        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: key
        ]
        let status = SecItemDelete(query as CFDictionary)
        return status == errSecSuccess || status == errSecItemNotFound
    }

    // MARK: - UUID Helpers

    @discardableResult
    func storeUUID(key: String, value: UUID) -> Bool {
        store(key: key, value: value.uuidString)
    }

    func retrieveUUID(key: String) -> UUID? {
        guard let str = retrieve(key: key) else { return nil }
        return UUID(uuidString: str)
    }
}
