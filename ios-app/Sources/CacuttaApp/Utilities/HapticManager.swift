import UIKit

// MARK: - HapticManager

final class HapticManager {
    static let shared = HapticManager()

    private let impactLight = UIImpactFeedbackGenerator(style: .light)
    private let impactMedium = UIImpactFeedbackGenerator(style: .medium)
    private let impactHeavy = UIImpactFeedbackGenerator(style: .heavy)
    private let impactRigid = UIImpactFeedbackGenerator(style: .rigid)
    private let notification = UINotificationFeedbackGenerator()
    private let selection = UISelectionFeedbackGenerator()

    private init() {
        impactLight.prepare()
        impactMedium.prepare()
        impactHeavy.prepare()
        notification.prepare()
        selection.prepare()
    }

    // MARK: - Impact

    func impact(_ style: UIImpactFeedbackGenerator.FeedbackStyle) {
        switch style {
        case .light: impactLight.impactOccurred()
        case .medium: impactMedium.impactOccurred()
        case .heavy: impactHeavy.impactOccurred()
        case .rigid: impactRigid.impactOccurred()
        default: impactMedium.impactOccurred()
        }
    }

    // MARK: - Notification

    func notification(_ type: UINotificationFeedbackGenerator.FeedbackType) {
        notification.notificationOccurred(type)
    }

    // MARK: - Selection

    func selectionChanged() {
        selection.selectionChanged()
    }

    // MARK: - Named Events

    /// Heavy impact for successful bid placement.
    func bidPlaced() { impact(.heavy) }

    /// Error + notification for being outbid.
    func outbid() { notification(.error) }

    /// Success notification for auction closing.
    func auctionClosed() { notification(.success) }

    /// Warning notification for timer extension.
    func timerExtended() { notification(.warning) }

    /// Rigid feedback on each timer second under 5.
    func urgentTick() { impact(.rigid) }

    /// Light feedback for code digit entry.
    func digitEntered() { selectionChanged() }
}
