import Foundation
import CoreLocation

@objc public class LocationManagerWrapper: NSObject, CLLocationManagerDelegate {
  @objc public static let shared = LocationManagerWrapper()

  private var locationManager: CLLocationManager?
  private var permissionManager: CLLocationManager?
  private let queue = DispatchQueue(label: "com.backgroundlocation.manager")

  private var isTrackingFlag = false
  private var currentSessionId: String?
  private var intervalMs: Double = 30_000
  private var distanceFilterM: Double = 25
  private var maxLocationAgeMs: Double = 60_000
  private var accuracy: String = "high"
  private var acceptedFirstFix = false
  private var lastEmittedAt: Date?
  private var availabilityWorkItem: DispatchWorkItem?
  private var emittedStableAvailable: Bool? = nil
  private let availabilityDebounceSeconds: Double = 2.0

  private var permissionCompletion: (([String: Any]) -> Void)?
  private var pendingForegroundOnly = false
  private var ignoreNextAuthCallback = false

  @objc public var onLocationUpdate: (([String: Any]) -> Void)?
  @objc public var onError: (([String: Any]) -> Void)?
  @objc public var onWarning: (([String: Any]) -> Void)?

  private override init() {
    super.init()
  }

  @objc public func startTracking(
    sessionId: String,
    intervalMs: Double,
    distanceFilterM: Double,
    maxLocationAgeMs: Double,
    accuracy: String
  ) {
    queue.sync {
      print("[EBBgLoc] startTracking session=\(sessionId) interval=\(intervalMs) filter=\(distanceFilterM) maxAge=\(maxLocationAgeMs) accuracy=\(accuracy)")
      self.currentSessionId = sessionId
      self.intervalMs = intervalMs > 0 ? intervalMs : 30_000
      self.distanceFilterM = distanceFilterM
      self.maxLocationAgeMs = maxLocationAgeMs > 0 ? maxLocationAgeMs : 60_000
      self.accuracy = accuracy
      self.isTrackingFlag = true
      self.acceptedFirstFix = false
      self.lastEmittedAt = nil
      self.resetAvailabilityDebounce()

      TrackingStateStore.shared.clearStopToken()
      let optionsJson = """
      {"intervalMs":\(self.intervalMs),"distanceFilterM":\(self.distanceFilterM),"maxLocationAgeMs":\(self.maxLocationAgeMs),"accuracy":"\(accuracy)"}
      """
      TrackingStateStore.shared.saveActive(sessionId: sessionId, optionsJson: optionsJson)

      DispatchQueue.main.async { [weak self] in
        self?.configureAndStart()
      }
    }
  }

  @objc public func stopTracking() {
    queue.sync {
      print("[EBBgLoc] stopTracking session=\(self.currentSessionId ?? "nil")")
      self.isTrackingFlag = false
      self.currentSessionId = nil
      self.acceptedFirstFix = false
      self.lastEmittedAt = nil
      self.resetAvailabilityDebounce()
      TrackingStateStore.shared.setStopToken()

      DispatchQueue.main.async { [weak self] in
        self?.locationManager?.stopUpdatingLocation()
        self?.locationManager = nil
      }
    }
  }

  @objc public func isTracking() -> [String: Any] {
    return queue.sync {
      if isTrackingFlag, let sessionId = currentSessionId {
        return ["active": true, "sessionId": sessionId]
      }
      if !TrackingStateStore.shared.isStopTokenSet() &&
        TrackingStateStore.shared.isActive(),
        let sessionId = TrackingStateStore.shared.sessionId() {
        return ["active": true, "sessionId": sessionId]
      }
      return ["active": false]
    }
  }

  @objc public func getSessionLocations(sessionId: String, limit: Int) -> [[String: Any]] {
    return LocationStore.shared.query(sessionId: sessionId, limit: limit)
  }

  @objc public func clearSessionLocations(sessionId: String?) {
    LocationStore.shared.clear(sessionId: sessionId)
  }

  @objc public func recoverIfNeeded() {
    queue.async { [weak self] in
      guard let self = self else { return }
      if TrackingStateStore.shared.isStopTokenSet() {
        print("[EBBgLoc] recoverIfNeeded skip: stop token set")
        return
      }
      if !TrackingStateStore.shared.isActive() {
        print("[EBBgLoc] recoverIfNeeded skip: store not active")
        return
      }
      if self.isTrackingFlag {
        print("[EBBgLoc] recoverIfNeeded skip: already tracking")
        return
      }
      guard let sessionId = TrackingStateStore.shared.sessionId() else {
        print("[EBBgLoc] recoverIfNeeded skip: no sessionId")
        return
      }

      let optionsJson = TrackingStateStore.shared.optionsJson() ?? ""
      if let data = optionsJson.data(using: .utf8),
         let obj = try? JSONSerialization.jsonObject(with: data) as? [String: Any] {
        self.intervalMs = (obj["intervalMs"] as? Double) ?? 30_000
        self.distanceFilterM = (obj["distanceFilterM"] as? Double) ?? 25
        self.maxLocationAgeMs = (obj["maxLocationAgeMs"] as? Double) ?? 60_000
        self.accuracy = (obj["accuracy"] as? String) ?? "high"
      }

      print("[EBBgLoc] recoverIfNeeded restarting session=\(sessionId)")
      self.currentSessionId = sessionId
      self.isTrackingFlag = true
      self.acceptedFirstFix = false
      self.lastEmittedAt = nil
      self.resetAvailabilityDebounce()
      DispatchQueue.main.async {
        self.configureAndStart()
      }
    }
  }

  @objc public func checkLocationPermission() -> [String: Any] {
    let status = CLLocationManager().authorizationStatus
    return mapAuthorizationStatus(status)
  }

  @objc public func requestLocationPermission(
    foregroundOnly: Bool,
    completion: @escaping ([String: Any]) -> Void
  ) {
    DispatchQueue.main.async { [weak self] in
      guard let self = self else {
        completion(["status": "undetermined", "canRequestAgain": true])
        return
      }

      let current = CLLocationManager().authorizationStatus

      switch current {
      case .authorizedAlways:
        print("[EBBgLoc] permission already Always")
        completion(self.mapAuthorizationStatus(current))
        return
      case .authorizedWhenInUse:
        if foregroundOnly {
          print("[EBBgLoc] permission WhenInUse (foregroundOnly)")
          completion(self.mapAuthorizationStatus(current))
          return
        }
        print("[EBBgLoc] escalate WhenInUse → Always")
        self.permissionCompletion = completion
        self.pendingForegroundOnly = false
        self.ignoreNextAuthCallback = true
        let manager = CLLocationManager()
        manager.delegate = self
        self.permissionManager = manager
        manager.requestAlwaysAuthorization()
        return
      case .denied, .restricted:
        print("[EBBgLoc] permission denied/restricted")
        completion(self.mapAuthorizationStatus(current))
        return
      case .notDetermined:
        print("[EBBgLoc] permission notDetermined — request WhenInUse")
        self.permissionCompletion = completion
        self.pendingForegroundOnly = foregroundOnly
        let manager = CLLocationManager()
        manager.delegate = self
        self.permissionManager = manager
        manager.requestWhenInUseAuthorization()
        return
      @unknown default:
        completion(["status": "undetermined", "canRequestAgain": true])
      }
    }
  }

  public func locationManagerDidChangeAuthorization(_ manager: CLLocationManager) {
    if ignoreNextAuthCallback {
      ignoreNextAuthCallback = false
      return
    }

    let status = manager.authorizationStatus

    if let completion = permissionCompletion {
      if status == .authorizedWhenInUse && !pendingForegroundOnly {
        print("[EBBgLoc] After WhenInUse grant, escalate to Always")
        ignoreNextAuthCallback = true
        manager.requestAlwaysAuthorization()
        return
      }
      permissionCompletion = nil
      permissionManager = nil
      print("[EBBgLoc] permission callback status=\(status.rawValue)")
      completion(mapAuthorizationStatus(status))
      return
    }

    if status == .denied || status == .restricted {
      var payload: [String: Any] = [
        "code": "PERMISSION_REVOKED",
        "message": "Location permission was denied.",
      ]
      if let sessionId = currentSessionId {
        payload["sessionId"] = sessionId
      }
      print("[EBBgLoc] PERMISSION_REVOKED — stopping")
      onError?(payload)
      stopTracking()
    }
  }

  public func locationManager(_ manager: CLLocationManager, didUpdateLocations locations: [CLLocation]) {
    queue.async { [weak self] in
      guard let self = self, self.isTrackingFlag, let sessionId = self.currentSessionId else { return }
      let now = Date()
      for location in locations {
        guard location.horizontalAccuracy >= 0 else {
          print("[EBBgLoc] skip invalid accuracy=\(location.horizontalAccuracy)")
          continue
        }
        let ageMs = now.timeIntervalSince(location.timestamp) * 1000.0
        if ageMs > self.maxLocationAgeMs && self.acceptedFirstFix {
          print("[EBBgLoc] skip stale location age=\(ageMs)ms max=\(self.maxLocationAgeMs)")
          continue
        }
        self.acceptedFirstFix = true

        let timestamp = location.timestamp.timeIntervalSince1970 * 1000.0
        let accuracy = location.horizontalAccuracy
        let speed = location.speed >= 0 ? location.speed : nil
        let heading = location.course >= 0 ? location.course : nil
        let altitude = location.altitude

        LocationStore.shared.insert(
          sessionId: sessionId,
          latitude: location.coordinate.latitude,
          longitude: location.coordinate.longitude,
          accuracy: accuracy,
          speed: speed,
          heading: heading,
          altitude: altitude,
          timestamp: timestamp
        )

        if self.emittedStableAvailable == false {
          self.scheduleAvailabilityEmit(available: true, sessionId: sessionId)
        }

        if let lastEmittedAt = self.lastEmittedAt {
          let elapsedMs = now.timeIntervalSince(lastEmittedAt) * 1000.0
          if elapsedMs < self.intervalMs {
            continue
          }
        }
        self.lastEmittedAt = now

        var payload: [String: Any] = [
          "sessionId": sessionId,
          "latitude": location.coordinate.latitude,
          "longitude": location.coordinate.longitude,
          "timestamp": timestamp,
        ]
        payload["accuracy"] = accuracy
        payload["speed"] = speed ?? NSNull()
        payload["heading"] = heading ?? NSNull()
        payload["altitude"] = altitude
        print("[EBBgLoc] GPS \(location.coordinate.latitude),\(location.coordinate.longitude) acc=\(accuracy)")
        self.onLocationUpdate?(payload)
      }
    }
  }

  public func locationManager(_ manager: CLLocationManager, didFailWithError error: Error) {
    let clError = error as? CLError
    if clError?.code == .denied {
      print("[EBBgLoc] didFailWithError PERMISSION_REVOKED")
      onError?([
        "code": "PERMISSION_REVOKED",
        "message": error.localizedDescription,
        "sessionId": currentSessionId as Any,
      ])
      stopTracking()
    } else {
      queue.async { [weak self] in
        guard let self = self, self.isTrackingFlag, let sessionId = self.currentSessionId else { return }
        print("[EBBgLoc] didFailWithError scheduling LOCATION_UNAVAILABLE: \(error.localizedDescription)")
        self.scheduleAvailabilityEmit(available: false, sessionId: sessionId)
      }
    }
  }

  public func locationManagerDidPauseLocationUpdates(_ manager: CLLocationManager) {
    print("[EBBgLoc] LOCATION_UPDATES_PAUSED")
    onWarning?([
      "code": "LOCATION_UPDATES_PAUSED",
      "message": "iOS paused location updates to save battery.",
      "sessionId": currentSessionId as Any,
    ])
  }

  private func resetAvailabilityDebounce() {
    availabilityWorkItem?.cancel()
    availabilityWorkItem = nil
    emittedStableAvailable = nil
  }

  private func scheduleAvailabilityEmit(available: Bool, sessionId: String) {
    availabilityWorkItem?.cancel()
    let work = DispatchWorkItem { [weak self] in
      guard let self = self, self.isTrackingFlag, self.currentSessionId == sessionId else { return }
      self.availabilityWorkItem = nil
      if available {
        if self.emittedStableAvailable == true { return }
        self.emittedStableAvailable = true
        self.onWarning?([
          "code": "LOCATION_AVAILABLE",
          "message": "GPS signal restored.",
          "sessionId": sessionId,
        ])
      } else {
        if self.emittedStableAvailable == false { return }
        self.emittedStableAvailable = false
        self.onWarning?([
          "code": "LOCATION_UNAVAILABLE",
          "message": "GPS signal lost or location services disabled.",
          "sessionId": sessionId,
        ])
      }
    }
    availabilityWorkItem = work
    queue.asyncAfter(deadline: .now() + availabilityDebounceSeconds, execute: work)
  }

  private func configureAndStart() {
    let manager = locationManager ?? CLLocationManager()
    manager.delegate = self
    manager.desiredAccuracy = accuracy == "low"
      ? kCLLocationAccuracyHundredMeters
      : accuracy == "balanced"
        ? kCLLocationAccuracyNearestTenMeters
        : kCLLocationAccuracyBest
    manager.distanceFilter = distanceFilterM > 0 ? distanceFilterM : kCLDistanceFilterNone
    manager.allowsBackgroundLocationUpdates = true
    manager.pausesLocationUpdatesAutomatically = false
    if #available(iOS 11.0, *) {
      manager.showsBackgroundLocationIndicator = true
    }
    locationManager = manager
    print("[EBBgLoc] configureAndStart accuracy=\(accuracy) filter=\(distanceFilterM)")
    manager.startUpdatingLocation()
  }

  private func mapAuthorizationStatus(_ status: CLAuthorizationStatus) -> [String: Any] {
    switch status {
    case .authorizedAlways:
      return ["status": "granted", "canRequestAgain": false]
    case .authorizedWhenInUse:
      return ["status": "whenInUse", "canRequestAgain": true]
    case .denied:
      return ["status": "denied", "canRequestAgain": false]
    case .restricted:
      return ["status": "blocked", "canRequestAgain": false]
    case .notDetermined:
      return ["status": "undetermined", "canRequestAgain": true]
    @unknown default:
      return ["status": "undetermined", "canRequestAgain": true]
    }
  }
}
