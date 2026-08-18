package com.echobitzit.backgroundlocation

import android.content.Context
import android.database.sqlite.SQLiteDatabase
import android.database.sqlite.SQLiteOpenHelper
import android.util.Log

/**
 * SQLite persistence for session location points.
 */
class LocationStore(context: Context) {
  private val dbHelper = LocationDbHelper(context.applicationContext)

  fun insert(
    sessionId: String,
    latitude: Double,
    longitude: Double,
    accuracy: Float?,
    speed: Float?,
    heading: Float?,
    altitude: Double?,
    timestamp: Long,
  ) {
    val db = dbHelper.writableDatabase
    val values = android.content.ContentValues().apply {
      put("session_id", sessionId)
      put("latitude", latitude)
      put("longitude", longitude)
      if (accuracy != null) put("accuracy", accuracy.toDouble())
      if (speed != null) put("speed", speed.toDouble())
      if (heading != null) put("heading", heading.toDouble())
      if (altitude != null) put("altitude", altitude)
      put("timestamp", timestamp)
    }
    db.insert("locations", null, values)
    trimSession(sessionId)
  }

  fun query(sessionId: String, limit: Int): List<StoredLocation> {
    val db = dbHelper.readableDatabase
    val safeLimit = if (limit > 0) limit else DEFAULT_QUERY_LIMIT
    val cursor = db.rawQuery(
      """
      SELECT session_id, latitude, longitude, accuracy, speed, heading, altitude, timestamp
      FROM locations
      WHERE session_id = ?
      ORDER BY timestamp DESC
      LIMIT ?
      """.trimIndent(),
      arrayOf(sessionId, safeLimit.toString()),
    )
    val results = mutableListOf<StoredLocation>()
    cursor.use {
      while (it.moveToNext()) {
        results.add(
          StoredLocation(
            sessionId = it.getString(0),
            latitude = it.getDouble(1),
            longitude = it.getDouble(2),
            accuracy = if (it.isNull(3)) null else it.getFloat(3),
            speed = if (it.isNull(4)) null else it.getFloat(4),
            heading = if (it.isNull(5)) null else it.getFloat(5),
            altitude = if (it.isNull(6)) null else it.getDouble(6),
            timestamp = it.getLong(7),
          )
        )
      }
    }
    return results
  }

  fun clear(sessionId: String?) {
    val db = dbHelper.writableDatabase
    if (sessionId.isNullOrBlank()) {
      db.delete("locations", null, null)
      Log.d(TAG, "clear all session locations")
    } else {
      db.delete("locations", "session_id = ?", arrayOf(sessionId))
      Log.d(TAG, "clear session locations session=$sessionId")
    }
  }

  private fun trimSession(sessionId: String) {
    val db = dbHelper.writableDatabase
    db.execSQL(
      """
      DELETE FROM locations
      WHERE session_id = ?
        AND id NOT IN (
          SELECT id FROM locations
          WHERE session_id = ?
          ORDER BY timestamp DESC
          LIMIT ?
        )
      """.trimIndent(),
      arrayOf(sessionId, sessionId, MAX_ROWS_PER_SESSION.toString()),
    )
  }

  data class StoredLocation(
    val sessionId: String,
    val latitude: Double,
    val longitude: Double,
    val accuracy: Float?,
    val speed: Float?,
    val heading: Float?,
    val altitude: Double?,
    val timestamp: Long,
  )

  private class LocationDbHelper(context: Context) :
    SQLiteOpenHelper(context, DB_NAME, null, DB_VERSION) {
    override fun onCreate(db: SQLiteDatabase) {
      db.execSQL(
        """
        CREATE TABLE locations (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          session_id TEXT NOT NULL,
          latitude REAL NOT NULL,
          longitude REAL NOT NULL,
          accuracy REAL,
          speed REAL,
          heading REAL,
          altitude REAL,
          timestamp INTEGER NOT NULL
        )
        """.trimIndent()
      )
      db.execSQL(
        "CREATE INDEX idx_locations_session_timestamp ON locations(session_id, timestamp DESC)"
      )
    }

    override fun onUpgrade(db: SQLiteDatabase, oldVersion: Int, newVersion: Int) {
      db.execSQL("DROP TABLE IF EXISTS locations")
      onCreate(db)
    }
  }

  companion object {
    private const val TAG = "EBBgLoc"
    private const val DB_NAME = "eb_background_locations.db"
    private const val DB_VERSION = 1
    private const val MAX_ROWS_PER_SESSION = 10_000
    private const val DEFAULT_QUERY_LIMIT = 500
  }
}
