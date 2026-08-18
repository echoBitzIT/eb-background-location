package com.echobitzit.backgroundlocation

import android.content.Context
import android.content.SharedPreferences
import android.util.Log
import org.json.JSONObject

/**
 * Persists tracking active flag, session id, options JSON, and stop token.
 */
class TrackingStateStore(context: Context) {
  private val prefs: SharedPreferences =
    context.applicationContext.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)

  fun isActive(): Boolean = prefs.getBoolean(KEY_ACTIVE, false)

  fun getSessionId(): String? = prefs.getString(KEY_SESSION_ID, null)

  fun getOptionsJson(): String? = prefs.getString(KEY_OPTIONS, null)

  fun isStopTokenSet(): Boolean = prefs.getBoolean(KEY_STOP_TOKEN, false)

  fun saveActive(sessionId: String, optionsJson: String) {
    Log.d(TAG, "store saveActive session=$sessionId")
    prefs.edit()
      .putBoolean(KEY_ACTIVE, true)
      .putString(KEY_SESSION_ID, sessionId)
      .putString(KEY_OPTIONS, optionsJson)
      .putBoolean(KEY_STOP_TOKEN, false)
      .apply()
  }

  fun clearActive() {
    prefs.edit()
      .putBoolean(KEY_ACTIVE, false)
      .remove(KEY_SESSION_ID)
      .remove(KEY_OPTIONS)
      .apply()
  }

  fun setStopToken() {
    Log.d(TAG, "store setStopToken")
    prefs.edit()
      .putBoolean(KEY_STOP_TOKEN, true)
      .putBoolean(KEY_ACTIVE, false)
      .remove(KEY_SESSION_ID)
      .remove(KEY_OPTIONS)
      .apply()
  }

  fun clearStopToken() {
    prefs.edit().putBoolean(KEY_STOP_TOKEN, false).apply()
  }

  companion object {
    private const val PREFS_NAME = "eb_background_location"
    private const val TAG = "EBBgLoc"
    private const val KEY_ACTIVE = "active"
    private const val KEY_SESSION_ID = "session_id"
    private const val KEY_OPTIONS = "options_json"
    private const val KEY_STOP_TOKEN = "stop_token"

    fun optionsToJson(
      intervalMs: Long,
      fastestIntervalMs: Long,
      distanceFilterM: Float,
      accuracy: String,
      maxLocationAgeMs: Long,
      notificationTitle: String,
      notificationText: String,
    ): String {
      return JSONObject()
        .put("intervalMs", intervalMs)
        .put("fastestIntervalMs", fastestIntervalMs)
        .put("distanceFilterM", distanceFilterM.toDouble())
        .put("accuracy", accuracy)
        .put("maxLocationAgeMs", maxLocationAgeMs)
        .put("notificationTitle", notificationTitle)
        .put("notificationText", notificationText)
        .toString()
    }

    fun parseOptions(json: String?): TrackingOptions {
      if (json.isNullOrBlank()) return TrackingOptions()
      return try {
        val obj = JSONObject(json)
        TrackingOptions(
          intervalMs = obj.optLong("intervalMs", TrackingOptions.DEFAULT_INTERVAL_MS),
          fastestIntervalMs = obj.optLong(
            "fastestIntervalMs",
            TrackingOptions.DEFAULT_FASTEST_INTERVAL_MS
          ),
          distanceFilterM = obj.optDouble(
            "distanceFilterM",
            TrackingOptions.DEFAULT_DISTANCE_FILTER_M.toDouble()
          ).toFloat(),
          accuracy = obj.optString("accuracy", "high"),
          maxLocationAgeMs = obj.optLong(
            "maxLocationAgeMs",
            TrackingOptions.DEFAULT_MAX_LOCATION_AGE_MS
          ),
          notificationTitle = obj.optString(
            "notificationTitle",
            TrackingOptions.DEFAULT_NOTIFICATION_TITLE
          ),
          notificationText = obj.optString(
            "notificationText",
            TrackingOptions.DEFAULT_NOTIFICATION_TEXT
          ),
        )
      } catch (_: Exception) {
        TrackingOptions()
      }
    }
  }
}

data class TrackingOptions(
  val intervalMs: Long = DEFAULT_INTERVAL_MS,
  val fastestIntervalMs: Long = DEFAULT_FASTEST_INTERVAL_MS,
  val distanceFilterM: Float = DEFAULT_DISTANCE_FILTER_M,
  val accuracy: String = "high",
  val maxLocationAgeMs: Long = DEFAULT_MAX_LOCATION_AGE_MS,
  val notificationTitle: String = DEFAULT_NOTIFICATION_TITLE,
  val notificationText: String = DEFAULT_NOTIFICATION_TEXT,
) {
  companion object {
    const val DEFAULT_INTERVAL_MS = 30_000L
    const val DEFAULT_FASTEST_INTERVAL_MS = 15_000L
    const val DEFAULT_DISTANCE_FILTER_M = 25f
    const val DEFAULT_MAX_LOCATION_AGE_MS = 60_000L
    const val DEFAULT_NOTIFICATION_TITLE = "Location tracking active"
    const val DEFAULT_NOTIFICATION_TEXT = "Sharing your location in the background"
  }
}
