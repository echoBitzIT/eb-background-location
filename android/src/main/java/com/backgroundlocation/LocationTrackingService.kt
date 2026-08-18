package com.backgroundlocation

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Context
import android.content.Intent
import android.content.pm.ServiceInfo
import android.location.Location
import android.os.Build
import android.os.Handler
import android.os.IBinder
import android.os.Looper
import android.util.Log
import androidx.core.app.NotificationCompat

/**
 * Foreground service that owns continuous GPS updates.
 */
class LocationTrackingService : Service() {
  private lateinit var store: TrackingStateStore
  private var locationStore: LocationStore? = null
  private var fusedHelper: FusedLocationHelper? = null
  private var sessionId: String? = null
  private var options: TrackingOptions = TrackingOptions()

  @Volatile
  private var stopRequested = false

  @Volatile
  private var acceptedFirstFix = false

  private val availabilityHandler = Handler(Looper.getMainLooper())
  private var availabilityRunnable: Runnable? = null

  /** Last stable availability state emitted to JS: true=available, false=unavailable, null=none */
  @Volatile
  private var emittedStableAvailable: Boolean? = null

  override fun onCreate() {
    super.onCreate()
    Log.d(TAG, "FGS onCreate")
    store = TrackingStateStore(this)
    locationStore = LocationStore(this)
    fusedHelper = FusedLocationHelper(this)
    isRunning = true
    activeInstance = this
  }

  override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
    Log.d(TAG, "FGS onStartCommand action=${intent?.action} session=${intent?.getStringExtra(EXTRA_SESSION_ID)}")
    // Always promote to foreground immediately (Android 12+ requirement).
    try {
      startForegroundWithType(createNotification(options))
      Log.d(TAG, "FGS startForeground success")
    } catch (e: Exception) {
      Log.e(TAG, "Failed to startForeground", e)
      stopSelf()
      return START_NOT_STICKY
    }

    if (intent?.action == ACTION_STOP) {
      Log.d(TAG, "FGS ACTION_STOP")
      stopTrackingInternal()
      return START_NOT_STICKY
    }

    stopRequested = false

    val incomingSession = intent?.getStringExtra(EXTRA_SESSION_ID)
    val optionsJson = intent?.getStringExtra(EXTRA_OPTIONS_JSON)

    if (incomingSession != null) {
      sessionId = incomingSession
      options = TrackingStateStore.parseOptions(optionsJson)
    } else {
      // System restart / redelivery — recover from store.
      if (store.isStopTokenSet() || !store.isActive()) {
        Log.d(TAG, "FGS recover skip: stopToken=${store.isStopTokenSet()} active=${store.isActive()}")
        stopTrackingInternal()
        return START_NOT_STICKY
      }
      sessionId = store.getSessionId()
      options = TrackingStateStore.parseOptions(store.getOptionsJson())
      if (sessionId.isNullOrBlank()) {
        Log.d(TAG, "FGS recover skip: no sessionId")
        stopTrackingInternal()
        return START_NOT_STICKY
      }
      Log.d(TAG, "FGS recovered from store session=$sessionId")
    }

    val sid = sessionId!!
    store.clearStopToken()
    store.saveActive(
      sid,
      TrackingStateStore.optionsToJson(
        options.intervalMs,
        options.fastestIntervalMs,
        options.distanceFilterM,
        options.accuracy,
        options.maxLocationAgeMs,
        options.notificationTitle,
        options.notificationText,
      )
    )

    try {
      startForegroundWithType(createNotification(options))
      Log.d(TAG, "FGS notification updated session=$sid interval=${options.intervalMs}")
    } catch (e: Exception) {
      Log.e(TAG, "Failed to update notification", e)
    }

    startLocationUpdates()
    return START_REDELIVER_INTENT
  }

  override fun onTimeout(startId: Int, fgsType: Int) {
    super.onTimeout(startId, fgsType)
    Log.w(TAG, "FGS timeout — restarting")
    val sid = sessionId
    val opts = options
    LocationEventBridge.emitWarning(
      "SERVICE_TIMEOUT",
      "Location service reached Android timeout limit. Restarting.",
      sid
    )
    fusedHelper?.stop()
    Handler(Looper.getMainLooper()).postDelayed({
      if (sid != null && !TrackingStateStore(applicationContext).isStopTokenSet()) {
        Log.d(TAG, "FGS timeout restart session=$sid")
        start(applicationContext, sid, opts)
      }
    }, 1000)
    stopSelf(startId)
  }

  override fun onTaskRemoved(rootIntent: Intent?) {
    super.onTaskRemoved(rootIntent)
    Log.d(TAG, "FGS onTaskRemoved session=$sessionId")
    LocationEventBridge.emitWarning(
      "TASK_REMOVED",
      "App removed from recents; tracking continues in background.",
      sessionId
    )
  }

  override fun onDestroy() {
    Log.d(TAG, "FGS onDestroy session=$sessionId")
    fusedHelper?.stop()
    fusedHelper = null
    isRunning = false
    if (activeInstance === this) {
      activeInstance = null
    }
    super.onDestroy()
  }

  override fun onBind(intent: Intent?): IBinder? = null

  private fun startLocationUpdates() {
    val sid = sessionId ?: return
    resetAvailabilityDebounce()
    acceptedFirstFix = false
    Log.d(TAG, "FGS startLocationUpdates session=$sid")
    fusedHelper?.start(
      options,
      onLocation = { location -> handleLocation(sid, location) },
      onAvailabilityChanged = { available ->
        scheduleAvailabilityEmit(available, sid)
      }
    )
  }

  private fun scheduleAvailabilityEmit(available: Boolean, sid: String) {
    availabilityRunnable?.let { availabilityHandler.removeCallbacks(it) }
    val runnable = Runnable {
      availabilityRunnable = null
      if (stopRequested || sessionId != sid) return@Runnable
      if (available) {
        if (emittedStableAvailable == true) return@Runnable
        emittedStableAvailable = true
        LocationEventBridge.emitWarning(
          "LOCATION_AVAILABLE",
          "GPS signal restored.",
          sid
        )
      } else {
        if (emittedStableAvailable == false) return@Runnable
        emittedStableAvailable = false
        LocationEventBridge.emitWarning(
          "LOCATION_UNAVAILABLE",
          "GPS signal lost or location services disabled.",
          sid
        )
      }
    }
    availabilityRunnable = runnable
    availabilityHandler.postDelayed(runnable, AVAILABILITY_DEBOUNCE_MS)
  }

  private fun resetAvailabilityDebounce() {
    availabilityRunnable?.let { availabilityHandler.removeCallbacks(it) }
    availabilityRunnable = null
    emittedStableAvailable = null
  }

  private fun handleLocation(sid: String, location: Location) {
    if (stopRequested) return

    // Reject invalid fixes.
    if (location.hasAccuracy() && location.accuracy < 0) return
    val wallAge = System.currentTimeMillis() - location.time
    val maxAge = options.maxLocationAgeMs
    if (wallAge > maxAge && acceptedFirstFix) {
      Log.d(TAG, "Skipping stale location age=${wallAge}ms max=$maxAge")
      return
    }
    acceptedFirstFix = true

    val accuracy = if (location.hasAccuracy()) location.accuracy else null
    val speed = if (location.hasSpeed()) location.speed else null
    val heading = if (location.hasBearing()) location.bearing else null
    val altitude = if (location.hasAltitude()) location.altitude else null

    locationStore?.insert(
      sessionId = sid,
      latitude = location.latitude,
      longitude = location.longitude,
      accuracy = accuracy,
      speed = speed,
      heading = heading,
      altitude = altitude,
      timestamp = location.time,
    )

    Log.d(
      TAG,
      "FGS emit location session=$sid lat=${location.latitude} lng=${location.longitude} acc=$accuracy"
    )
    LocationEventBridge.emitLocation(
      sessionId = sid,
      latitude = location.latitude,
      longitude = location.longitude,
      accuracy = accuracy,
      speed = speed,
      heading = heading,
      altitude = altitude,
      timestamp = location.time,
    )
  }

  private fun stopTrackingInternal() {
    Log.d(TAG, "FGS stopTrackingInternal session=$sessionId")
    stopRequested = true
    resetAvailabilityDebounce()
    acceptedFirstFix = false
    fusedHelper?.stop()
    store.setStopToken()
    stopForeground(STOP_FOREGROUND_REMOVE)
    stopSelf()
  }

  private fun startForegroundWithType(notification: Notification) {
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.UPSIDE_DOWN_CAKE) {
      startForeground(
        NOTIFICATION_ID,
        notification,
        ServiceInfo.FOREGROUND_SERVICE_TYPE_LOCATION
      )
    } else {
      startForeground(NOTIFICATION_ID, notification)
    }
  }

  private fun createNotification(opts: TrackingOptions): Notification {
    createChannel()
    val launchIntent = packageManager.getLaunchIntentForPackage(packageName)
    val pendingIntent = if (launchIntent != null) {
      PendingIntent.getActivity(
        this,
        0,
        launchIntent,
        PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
      )
    } else {
      null
    }

    return NotificationCompat.Builder(this, CHANNEL_ID)
      .setContentTitle(opts.notificationTitle)
      .setContentText(opts.notificationText)
      .setSmallIcon(android.R.drawable.ic_menu_mylocation)
      .setOngoing(true)
      .setOnlyAlertOnce(true)
      .setCategory(NotificationCompat.CATEGORY_SERVICE)
      .setPriority(NotificationCompat.PRIORITY_LOW)
      .apply {
        if (pendingIntent != null) setContentIntent(pendingIntent)
      }
      .build()
  }

  private fun createChannel() {
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return
    val manager = getSystemService(NotificationManager::class.java) ?: return
    val channel = NotificationChannel(
      CHANNEL_ID,
      "Background location",
      NotificationManager.IMPORTANCE_LOW
    ).apply {
      description = "Shows while background location tracking is active"
      setShowBadge(false)
    }
    manager.createNotificationChannel(channel)
  }

  companion object {
    private const val TAG = "EBBgLoc"
    private const val CHANNEL_ID = "eb_background_location"
    private const val NOTIFICATION_ID = 0xEB10
    private const val AVAILABILITY_DEBOUNCE_MS = 2000L

    const val ACTION_STOP = "com.backgroundlocation.ACTION_STOP"
    const val EXTRA_SESSION_ID = "session_id"
    const val EXTRA_OPTIONS_JSON = "options_json"

    @Volatile
    var isRunning: Boolean = false
      private set

    @Volatile
    private var activeInstance: LocationTrackingService? = null

    fun start(context: Context, sessionId: String, options: TrackingOptions) {
      val optionsJson = TrackingStateStore.optionsToJson(
        options.intervalMs,
        options.fastestIntervalMs,
        options.distanceFilterM,
        options.accuracy,
        options.maxLocationAgeMs,
        options.notificationTitle,
        options.notificationText,
      )
      val intent = Intent(context, LocationTrackingService::class.java).apply {
        putExtra(EXTRA_SESSION_ID, sessionId)
        putExtra(EXTRA_OPTIONS_JSON, optionsJson)
      }
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
        context.startForegroundService(intent)
      } else {
        context.startService(intent)
      }
    }

    fun stop(context: Context) {
      val intent = Intent(context, LocationTrackingService::class.java).apply {
        action = ACTION_STOP
      }
      try {
        context.startService(intent)
      } catch (_: Exception) {
        // Service may already be gone.
      }
      activeInstance?.stopTrackingInternal()
    }
  }
}
