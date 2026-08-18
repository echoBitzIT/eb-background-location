package com.echobitzit.backgroundlocation

import android.annotation.SuppressLint
import android.content.Context
import android.location.Location
import android.os.Looper
import android.util.Log
import com.google.android.gms.location.FusedLocationProviderClient
import com.google.android.gms.location.LocationCallback
import com.google.android.gms.location.LocationRequest
import com.google.android.gms.location.LocationResult
import com.google.android.gms.location.LocationServices
import com.google.android.gms.location.Priority

/**
 * Thin wrapper around FusedLocationProviderClient.
 */
class FusedLocationHelper(context: Context) {
  private val client: FusedLocationProviderClient =
    LocationServices.getFusedLocationProviderClient(context.applicationContext)

  private var callback: LocationCallback? = null

  @SuppressLint("MissingPermission")
  fun start(
    options: TrackingOptions,
    onLocation: (Location) -> Unit,
    onAvailabilityChanged: (Boolean) -> Unit,
  ) {
    stop()

    val priority = when (options.accuracy.lowercase()) {
      "balanced" -> Priority.PRIORITY_BALANCED_POWER_ACCURACY
      "low" -> Priority.PRIORITY_LOW_POWER
      else -> Priority.PRIORITY_HIGH_ACCURACY
    }

    Log.d(
      TAG,
      "FusedLocation start interval=${options.intervalMs} fastest=${options.fastestIntervalMs} filter=${options.distanceFilterM} accuracy=${options.accuracy} priority=$priority"
    )

    val request = LocationRequest.Builder(priority, options.intervalMs)
      .setMinUpdateIntervalMillis(options.fastestIntervalMs)
      .apply {
        if (options.distanceFilterM > 0f) {
          setMinUpdateDistanceMeters(options.distanceFilterM)
        }
      }
      .build()

    callback = object : LocationCallback() {
      override fun onLocationResult(result: LocationResult) {
        Log.d(TAG, "FusedLocation onLocationResult count=${result.locations.size}")
        for (location in result.locations) {
          onLocation(location)
        }
      }

      override fun onLocationAvailability(
        availability: com.google.android.gms.location.LocationAvailability
      ) {
        Log.d(TAG, "FusedLocation availability=${availability.isLocationAvailable}")
        onAvailabilityChanged(availability.isLocationAvailable)
      }
    }

    client.requestLocationUpdates(request, callback!!, Looper.getMainLooper())
  }

  fun stop() {
    Log.d(TAG, "FusedLocation stop")
    callback?.let { client.removeLocationUpdates(it) }
    callback = null
  }

  companion object {
    private const val TAG = "EBBgLoc"
  }
}
