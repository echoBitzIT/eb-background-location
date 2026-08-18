import Foundation

@objc public class TrackingStateStore: NSObject {
  private static let defaults = UserDefaults.standard
  private static let keyActive = "eb_bg_location_active"
  private static let keySessionId = "eb_bg_location_session_id"
  private static let keyOptions = "eb_bg_location_options"
  private static let keyStopToken = "eb_bg_location_stop_token"

  @objc public static let shared = TrackingStateStore()

  @objc public func isActive() -> Bool {
    return Self.defaults.bool(forKey: Self.keyActive)
  }

  @objc public func sessionId() -> String? {
    return Self.defaults.string(forKey: Self.keySessionId)
  }

  @objc public func optionsJson() -> String? {
    return Self.defaults.string(forKey: Self.keyOptions)
  }

  @objc public func isStopTokenSet() -> Bool {
    return Self.defaults.bool(forKey: Self.keyStopToken)
  }

  @objc public func saveActive(sessionId: String, optionsJson: String) {
    print("[EBBgLoc] store saveActive session=\(sessionId)")
    Self.defaults.set(true, forKey: Self.keyActive)
    Self.defaults.set(sessionId, forKey: Self.keySessionId)
    Self.defaults.set(optionsJson, forKey: Self.keyOptions)
    Self.defaults.set(false, forKey: Self.keyStopToken)
  }

  @objc public func setStopToken() {
    print("[EBBgLoc] store setStopToken")
    Self.defaults.set(true, forKey: Self.keyStopToken)
    Self.defaults.set(false, forKey: Self.keyActive)
    Self.defaults.removeObject(forKey: Self.keySessionId)
    Self.defaults.removeObject(forKey: Self.keyOptions)
  }

  @objc public func clearStopToken() {
    Self.defaults.set(false, forKey: Self.keyStopToken)
  }

  @objc public func clearActive() {
    Self.defaults.set(false, forKey: Self.keyActive)
    Self.defaults.removeObject(forKey: Self.keySessionId)
    Self.defaults.removeObject(forKey: Self.keyOptions)
  }
}
