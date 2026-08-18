package com.echobitzit.backgroundlocation

import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.WritableMap
import com.facebook.react.modules.core.DeviceEventManagerModule
import android.util.Log

/**
 * Bridges location events from the foreground service to the JS runtime.
 */
object LocationEventBridge {
  @Volatile
  private var reactContext: ReactApplicationContext? = null

  fun attach(context: ReactApplicationContext) {
    reactContext = context
  }

  fun detach(context: ReactApplicationContext) {
    if (reactContext === context) {
      reactContext = null
    }
  }

  fun emitLocation(
    sessionId: String,
    latitude: Double,
    longitude: Double,
    accuracy: Float?,
    speed: Float?,
    heading: Float?,
    altitude: Double?,
    timestamp: Long,
  ) {
    val map = Arguments.createMap().apply {
      putString("sessionId", sessionId)
      putDouble("latitude", latitude)
      putDouble("longitude", longitude)
      if (accuracy != null) putDouble("accuracy", accuracy.toDouble())
      else putNull("accuracy")
      if (speed != null) putDouble("speed", speed.toDouble())
      else putNull("speed")
      if (heading != null) putDouble("heading", heading.toDouble())
      else putNull("heading")
      if (altitude != null) putDouble("altitude", altitude)
      else putNull("altitude")
      putDouble("timestamp", timestamp.toDouble())
    }
    Log.d(TAG, "emit location session=$sessionId")
    emit("location", map)
  }

  fun emitError(code: String, message: String, sessionId: String?) {
    Log.d(TAG, "emit error code=$code session=$sessionId")
    val map = Arguments.createMap().apply {
      putString("code", code)
      putString("message", message)
      if (sessionId != null) putString("sessionId", sessionId)
    }
    emit("error", map)
  }

  fun emitWarning(code: String, message: String, sessionId: String?) {
    Log.d(TAG, "emit warning code=$code session=$sessionId")
    val map = Arguments.createMap().apply {
      putString("code", code)
      putString("message", message)
      if (sessionId != null) putString("sessionId", sessionId)
    }
    emit("warning", map)
  }

  private fun emit(eventName: String, payload: WritableMap) {
    val context = reactContext
    if (context == null) {
      Log.d(TAG, "skip emit $eventName: reactContext is null")
      return
    }
    if (!context.hasActiveReactInstance()) {
      Log.d(TAG, "skip emit $eventName: no active React instance")
      return
    }
    try {
      Log.d(TAG, "emit $eventName")
      context
        .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
        .emit(eventName, payload)
    } catch (e: Exception) {
      Log.e(TAG, "Failed to emit $eventName", e)
    }
  }

  private const val TAG = "EBBgLoc"
}
