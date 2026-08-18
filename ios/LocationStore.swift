import Foundation
import SQLite3

@objc public class LocationStore: NSObject {
  @objc public static let shared = LocationStore()

  private let queue = DispatchQueue(label: "com.echobitzit.backgroundlocation.locationstore")
  private var db: OpaquePointer?
  private let maxRowsPerSession = 10_000

  private override init() {
    super.init()
    openDatabase()
    createTableIfNeeded()
  }

  deinit {
    if db != nil {
      sqlite3_close(db)
    }
  }

  @objc public func insert(
    sessionId: String,
    latitude: Double,
    longitude: Double,
    accuracy: Double?,
    speed: Double?,
    heading: Double?,
    altitude: Double?,
    timestamp: Double
  ) {
    queue.sync {
      guard let db = db else { return }
      let sql = """
      INSERT INTO locations (
        session_id, latitude, longitude, accuracy, speed, heading, altitude, timestamp
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      """
      var statement: OpaquePointer?
      guard sqlite3_prepare_v2(db, sql, -1, &statement, nil) == SQLITE_OK else {
        return
      }
      defer { sqlite3_finalize(statement) }

      sqlite3_bind_text(statement, 1, (sessionId as NSString).utf8String, -1, nil)
      sqlite3_bind_double(statement, 2, latitude)
      sqlite3_bind_double(statement, 3, longitude)
      if let accuracy = accuracy {
        sqlite3_bind_double(statement, 4, accuracy)
      } else {
        sqlite3_bind_null(statement, 4)
      }
      if let speed = speed {
        sqlite3_bind_double(statement, 5, speed)
      } else {
        sqlite3_bind_null(statement, 5)
      }
      if let heading = heading {
        sqlite3_bind_double(statement, 6, heading)
      } else {
        sqlite3_bind_null(statement, 6)
      }
      if let altitude = altitude {
        sqlite3_bind_double(statement, 7, altitude)
      } else {
        sqlite3_bind_null(statement, 7)
      }
      sqlite3_bind_double(statement, 8, timestamp)

      if sqlite3_step(statement) != SQLITE_DONE {
        print("[EBBgLoc] LocationStore insert failed")
      }
      trimSession(sessionId: sessionId)
    }
  }

  @objc public func query(sessionId: String, limit: Int) -> [[String: Any]] {
    queue.sync {
      guard let db = db else { return [] }
      let safeLimit = limit > 0 ? limit : 500
      let sql = """
      SELECT session_id, latitude, longitude, accuracy, speed, heading, altitude, timestamp
      FROM locations
      WHERE session_id = ?
      ORDER BY timestamp DESC
      LIMIT ?
      """
      var statement: OpaquePointer?
      guard sqlite3_prepare_v2(db, sql, -1, &statement, nil) == SQLITE_OK else {
        return []
      }
      defer { sqlite3_finalize(statement) }

      sqlite3_bind_text(statement, 1, (sessionId as NSString).utf8String, -1, nil)
      sqlite3_bind_int(statement, 2, Int32(safeLimit))

      var results: [[String: Any]] = []
      while sqlite3_step(statement) == SQLITE_ROW {
        let sid = String(cString: sqlite3_column_text(statement, 0))
        let latitude = sqlite3_column_double(statement, 1)
        let longitude = sqlite3_column_double(statement, 2)
        var row: [String: Any] = [
          "sessionId": sid,
          "latitude": latitude,
          "longitude": longitude,
          "timestamp": sqlite3_column_double(statement, 7),
        ]
        if sqlite3_column_type(statement, 3) != SQLITE_NULL {
          row["accuracy"] = sqlite3_column_double(statement, 3)
        }
        if sqlite3_column_type(statement, 4) != SQLITE_NULL {
          row["speed"] = sqlite3_column_double(statement, 4)
        }
        if sqlite3_column_type(statement, 5) != SQLITE_NULL {
          row["heading"] = sqlite3_column_double(statement, 5)
        }
        if sqlite3_column_type(statement, 6) != SQLITE_NULL {
          row["altitude"] = sqlite3_column_double(statement, 6)
        }
        results.append(row)
      }
      return results
    }
  }

  @objc public func clear(sessionId: String?) {
    queue.sync {
      guard let db = db else { return }
      if let sessionId = sessionId, !sessionId.isEmpty {
        let sql = "DELETE FROM locations WHERE session_id = ?"
        var statement: OpaquePointer?
        guard sqlite3_prepare_v2(db, sql, -1, &statement, nil) == SQLITE_OK else { return }
        defer { sqlite3_finalize(statement) }
        sqlite3_bind_text(statement, 1, (sessionId as NSString).utf8String, -1, nil)
        sqlite3_step(statement)
        print("[EBBgLoc] LocationStore clear session=\(sessionId)")
      } else {
        sqlite3_exec(db, "DELETE FROM locations", nil, nil, nil)
        print("[EBBgLoc] LocationStore clear all")
      }
    }
  }

  private func openDatabase() {
    let urls = FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask)
    let base = urls.first ?? FileManager.default.temporaryDirectory
    let dir = base.appendingPathComponent("eb_background_location", isDirectory: true)
    try? FileManager.default.createDirectory(at: dir, withIntermediateDirectories: true)
    let path = dir.appendingPathComponent("locations.db").path
    if sqlite3_open(path, &db) != SQLITE_OK {
      print("[EBBgLoc] LocationStore failed to open db at \(path)")
      db = nil
    }
  }

  private func createTableIfNeeded() {
    guard let db = db else { return }
    let sql = """
    CREATE TABLE IF NOT EXISTS locations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      session_id TEXT NOT NULL,
      latitude REAL NOT NULL,
      longitude REAL NOT NULL,
      accuracy REAL,
      speed REAL,
      heading REAL,
      altitude REAL,
      timestamp REAL NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_locations_session_timestamp
      ON locations(session_id, timestamp DESC);
    """
    sqlite3_exec(db, sql, nil, nil, nil)
  }

  private func trimSession(sessionId: String) {
    guard let db = db else { return }
    let sql = """
    DELETE FROM locations
    WHERE session_id = ?
      AND id NOT IN (
        SELECT id FROM locations
        WHERE session_id = ?
        ORDER BY timestamp DESC
        LIMIT ?
      )
    """
    var statement: OpaquePointer?
    guard sqlite3_prepare_v2(db, sql, -1, &statement, nil) == SQLITE_OK else { return }
    defer { sqlite3_finalize(statement) }
    sqlite3_bind_text(statement, 1, (sessionId as NSString).utf8String, -1, nil)
    sqlite3_bind_text(statement, 2, (sessionId as NSString).utf8String, -1, nil)
    sqlite3_bind_int(statement, 3, Int32(maxRowsPerSession))
    sqlite3_step(statement)
  }
}
