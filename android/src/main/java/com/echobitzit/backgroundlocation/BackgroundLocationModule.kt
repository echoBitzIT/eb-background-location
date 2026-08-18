package com.echobitzit.backgroundlocation

import android.Manifest
import android.content.pm.PackageManager
import android.os.Build
import android.util.Log
import androidx.core.content.ContextCompat
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.LifecycleEventListener
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReadableMap
import com.facebook.react.module.annotations.ReactModule

@ReactModule(name = BackgroundLocationModule.NAME)
class BackgroundLocationModule(reactContext: ReactApplicationContext) :
  NativeBackgroundLocationSpec(reactContext), LifecycleEventListener {

  private val store = TrackingStateStore(reactContext)
  private val locationStore = LocationStore(reactContext)

  init {
    reactContext.addLifecycleEventListener(this)
    LocationEventBridge.attach(reactContext)
  }

  override fun invalidate() {
    LocationEventBridge.detach(reactApplicationContext)
    reactApplicationContext.removeLifecycleEventListener(this)
    super.invalidate()
  }

  override fun startTracking(sessionId: String, options: ReadableMap?, promise: Promise) {
    try {
      val parsed = parseOptions(options)
      Log.d(
        TAG,
        "startTracking session=$sessionId interval=${parsed.intervalMs} fastest=${parsed.fastestIntervalMs} filter=${parsed.distanceFilterM} accuracy=${parsed.accuracy} maxAge=${parsed.maxLocationAgeMs}"
      )
      if (!hasFineLocationPermission()) {
        Log.d(TAG, "startTracking REJECT PERMISSION_DENIED")
        promise.reject(
          "PERMISSION_DENIED",
          "ACCESS_FINE_LOCATION is required before starting tracking."
        )
        return
      }
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q &&
        !hasBackgroundLocationPermission()
      ) {
        Log.d(TAG, "startTracking REJECT BACKGROUND_PERMISSION_REQUIRED")
        promise.reject(
          "BACKGROUND_PERMISSION_REQUIRED",
          "ACCESS_BACKGROUND_LOCATION is required for background tracking. Grant 'Allow all the time' in settings."
        )
        return
      }
      if (!hasNotificationPermission()) {
        Log.d(TAG, "startTracking REJECT NOTIFICATION_PERMISSION_DENIED")
        promise.reject(
          "NOTIFICATION_PERMISSION_DENIED",
          "POST_NOTIFICATIONS is required for the foreground service notification on Android 13+."
        )
        return
      }

      store.clearStopToken()
      store.saveActive(
        sessionId,
        TrackingStateStore.optionsToJson(
          parsed.intervalMs,
          parsed.fastestIntervalMs,
          parsed.distanceFilterM,
          parsed.accuracy,
          parsed.maxLocationAgeMs,
          parsed.notificationTitle,
          parsed.notificationText,
        )
      )
      LocationTrackingService.start(reactApplicationContext, sessionId, parsed)
      Log.d(TAG, "startTracking service started session=$sessionId")
      promise.resolve(null)
    } catch (e: Exception) {
      Log.d(TAG, "startTracking error: ${e.message}")
      promise.reject("START_TRACKING_ERROR", e.message, e)
    }
  }

  override fun stopTracking(promise: Promise) {
    try {
      Log.d(TAG, "stopTracking")
      store.setStopToken()
      LocationTrackingService.stop(reactApplicationContext)
      promise.resolve(null)
    } catch (e: Exception) {
      Log.d(TAG, "stopTracking error: ${e.message}")
      promise.reject("STOP_TRACKING_ERROR", e.message, e)
    }
  }

  override fun isTracking(promise: Promise) {
    try {
      val running =
        LocationTrackingService.isRunning && !store.isStopTokenSet()
      val sid = if (running) store.getSessionId() else null
      Log.d(
        TAG,
        "isTracking active=$running session=$sid serviceRunning=${LocationTrackingService.isRunning}"
      )
      val map = Arguments.createMap().apply {
        putBoolean("active", running)
        if (sid != null) putString("sessionId", sid)
      }
      promise.resolve(map)
    } catch (e: Exception) {
      Log.d(TAG, "isTracking error: ${e.message}")
      promise.reject("IS_TRACKING_ERROR", e.message, e)
    }
  }

  override fun getLocationPermissionStatus(promise: Promise) {
    try {
      promise.resolve(buildPermissionStatusMap(foregroundOnly = false))
    } catch (e: Exception) {
      promise.reject("GET_PERMISSION_STATUS_ERROR", e.message, e)
    }
  }

  override fun getSessionLocations(
    sessionId: String,
    limit: Double?,
    promise: Promise,
  ) {
    try {
      val safeLimit = if (limit != null && limit > 0) limit.toInt() else 500
      val rows = locationStore.query(sessionId, safeLimit)
      val array = Arguments.createArray()
      for (row in rows) {
        array.pushMap(
          Arguments.createMap().apply {
            putString("sessionId", row.sessionId)
            putDouble("latitude", row.latitude)
            putDouble("longitude", row.longitude)
            if (row.accuracy != null) putDouble("accuracy", row.accuracy.toDouble())
            else putNull("accuracy")
            if (row.speed != null) putDouble("speed", row.speed.toDouble())
            else putNull("speed")
            if (row.heading != null) putDouble("heading", row.heading.toDouble())
            else putNull("heading")
            if (row.altitude != null) putDouble("altitude", row.altitude)
            else putNull("altitude")
            putDouble("timestamp", row.timestamp.toDouble())
          }
        )
      }
      promise.resolve(array)
    } catch (e: Exception) {
      promise.reject("GET_SESSION_LOCATIONS_ERROR", e.message, e)
    }
  }

  override fun clearSessionLocations(sessionId: String?, promise: Promise) {
    try {
      locationStore.clear(sessionId)
      promise.resolve(null)
    } catch (e: Exception) {
      promise.reject("CLEAR_SESSION_LOCATIONS_ERROR", e.message, e)
    }
  }

  override fun requestLocationPermission(foregroundOnly: Boolean, promise: Promise) {
    // Android permission prompts are driven from JS via PermissionsAndroid.
    // Native side reports the current grant state.
    try {
      promise.resolve(buildPermissionStatusMap(foregroundOnly))
    } catch (e: Exception) {
      promise.reject("REQUEST_PERMISSION_ERROR", e.message, e)
    }
  }

  override fun requestNotificationPermission(promise: Promise) {
    try {
      promise.resolve(if (hasNotificationPermission()) "granted" else "denied")
    } catch (e: Exception) {
      promise.reject("REQUEST_NOTIFICATION_PERMISSION_ERROR", e.message, e)
    }
  }

  override fun addListener(eventName: String) {
    // Required for NativeEventEmitter — events are pushed via RCTDeviceEventEmitter.
  }

  override fun removeListeners(count: Double) {
    // Required for NativeEventEmitter.
  }

  override fun onHostResume() {
    LocationEventBridge.attach(reactApplicationContext)
    // Resume / recover tracking if store says active and service died.
    if (store.isStopTokenSet()) {
      Log.d(TAG, "onHostResume skip: stop token set")
      return
    }
    if (!store.isActive()) {
      Log.d(TAG, "onHostResume skip: store not active")
      return
    }
    if (LocationTrackingService.isRunning) {
      Log.d(TAG, "onHostResume skip: service already running")
      return
    }
    val sessionId = store.getSessionId()
    if (sessionId == null) {
      Log.d(TAG, "onHostResume skip: no sessionId")
      return
    }
    if (!hasFineLocationPermission() || !hasNotificationPermission()) {
      Log.d(TAG, "onHostResume skip: missing permission")
      return
    }
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q &&
      !hasBackgroundLocationPermission()
    ) {
      Log.d(TAG, "onHostResume skip: missing background permission")
      return
    }
    val options = TrackingStateStore.parseOptions(store.getOptionsJson())
    Log.d(TAG, "onHostResume restarting service session=$sessionId")
    LocationTrackingService.start(reactApplicationContext, sessionId, options)
  }

  override fun onHostPause() = Unit

  override fun onHostDestroy() {
    LocationEventBridge.detach(reactApplicationContext)
  }

  private fun buildPermissionStatusMap(foregroundOnly: Boolean): com.facebook.react.bridge.WritableMap {
    val fine = hasFineLocationPermission()
    val background = hasBackgroundLocationPermission()
    val map = Arguments.createMap()
    when {
      fine && (foregroundOnly || background || Build.VERSION.SDK_INT < Build.VERSION_CODES.Q) -> {
        map.putString("status", "granted")
        map.putBoolean("canRequestAgain", true)
      }
      fine -> {
        map.putString("status", "whenInUse")
        map.putBoolean("canRequestAgain", true)
      }
      else -> {
        map.putString("status", "denied")
        map.putBoolean("canRequestAgain", true)
      }
    }
    return map
  }

  private fun parseOptions(options: ReadableMap?): TrackingOptions {
    if (options == null) return TrackingOptions()
    return TrackingOptions(
      intervalMs = if (options.hasKey("intervalMs")) {
        options.getDouble("intervalMs").toLong()
      } else {
        TrackingOptions.DEFAULT_INTERVAL_MS
      },
      fastestIntervalMs = if (options.hasKey("fastestIntervalMs")) {
        options.getDouble("fastestIntervalMs").toLong()
      } else {
        TrackingOptions.DEFAULT_FASTEST_INTERVAL_MS
      },
      distanceFilterM = if (options.hasKey("distanceFilterM")) {
        options.getDouble("distanceFilterM").toFloat()
      } else {
        TrackingOptions.DEFAULT_DISTANCE_FILTER_M
      },
      accuracy = if (options.hasKey("accuracy")) {
        options.getString("accuracy") ?: "high"
      } else {
        "high"
      },
      maxLocationAgeMs = if (options.hasKey("maxLocationAgeMs")) {
        options.getDouble("maxLocationAgeMs").toLong()
      } else {
        TrackingOptions.DEFAULT_MAX_LOCATION_AGE_MS
      },
      notificationTitle = if (options.hasKey("notificationTitle")) {
        options.getString("notificationTitle")
          ?: TrackingOptions.DEFAULT_NOTIFICATION_TITLE
      } else {
        TrackingOptions.DEFAULT_NOTIFICATION_TITLE
      },
      notificationText = if (options.hasKey("notificationText")) {
        options.getString("notificationText")
          ?: TrackingOptions.DEFAULT_NOTIFICATION_TEXT
      } else {
        TrackingOptions.DEFAULT_NOTIFICATION_TEXT
      },
    )
  }

  private fun hasFineLocationPermission(): Boolean {
    val fine = ContextCompat.checkSelfPermission(
      reactApplicationContext,
      Manifest.permission.ACCESS_FINE_LOCATION
    ) == PackageManager.PERMISSION_GRANTED
    val coarse = ContextCompat.checkSelfPermission(
      reactApplicationContext,
      Manifest.permission.ACCESS_COARSE_LOCATION
    ) == PackageManager.PERMISSION_GRANTED
    return fine || coarse
  }

  private fun hasBackgroundLocationPermission(): Boolean {
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.Q) return true
    return ContextCompat.checkSelfPermission(
      reactApplicationContext,
      Manifest.permission.ACCESS_BACKGROUND_LOCATION
    ) == PackageManager.PERMISSION_GRANTED
  }

  private fun hasNotificationPermission(): Boolean {
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.TIRAMISU) return true
    return ContextCompat.checkSelfPermission(
      reactApplicationContext,
      Manifest.permission.POST_NOTIFICATIONS
    ) == PackageManager.PERMISSION_GRANTED
  }

  companion object {
    const val NAME = "BackgroundLocation"
    private const val TAG = "EBBgLoc"
  }
}
