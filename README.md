# @echobitz_it/react-native-background-location

React Native **TurboModule** for background GPS tracking.

- **Android:** Foreground Service (`location`) + Fused Location Provider
- **iOS:** `CLLocationManager` with Always + background updates
- **Not** Expo Go — New Architecture is required

Inspired by patterns in [@gabriel-sisjr/react-native-background-location](https://github.com/gabriel-sisjr/react-native-background-location) (MIT). This package is an independent slim implementation (no geofencing / Expo / trip DB).

## Requirements

| Requirement | Version |
| --- | --- |
| React Native | >= 0.73 (New Architecture). Tested on 0.85 / React 19 |
| Android minSdk | 24 |
| iOS | 16+ |
| Expo Go | Not supported |

## Install

```bash
npm install @echobitz_it/react-native-background-location
# or
yarn add @echobitz_it/react-native-background-location
```

iOS:

```bash
cd ios && pod install
```

## Setup

### iOS

Add to the host app `Info.plist`:

```xml
<key>NSLocationWhenInUseUsageDescription</key>
<string>Your location is used to track activity while the app is open.</string>
<key>NSLocationAlwaysAndWhenInUseUsageDescription</key>
<string>Background location is required so tracking continues when the app is minimized or the phone is locked.</string>
<key>UIBackgroundModes</key>
<array>
  <string>location</string>
</array>
```

### Android

This library merges the following permissions into the host app:

- `ACCESS_FINE_LOCATION` / `ACCESS_COARSE_LOCATION`
- `ACCESS_BACKGROUND_LOCATION`
- `FOREGROUND_SERVICE` / `FOREGROUND_SERVICE_LOCATION`
- `POST_NOTIFICATIONS` (Android 13+)

You still must request them at runtime (see API below). Google Play requires a prominent in-app disclosure and Play Console declarations for background location and a location foreground service.

The host app must run with the **New Architecture** enabled.

## API

```ts
import {
  requestLocationPermission,
  requestNotificationPermission,
  getLocationPermissionStatus,
  startTracking,
  stopTracking,
  isTracking,
  getSessionLocations,
  clearSessionLocations,
  addLocationListener,
  addErrorListener,
  addWarningListener,
} from '@echobitz_it/react-native-background-location';

await requestNotificationPermission();
await requestLocationPermission(false); // When In Use → Always / Background

await startTracking('session-1', {
  intervalMs: 30000,
  fastestIntervalMs: 15000,
  distanceFilterM: 25,
  accuracy: 'high',
  maxLocationAgeMs: 60000,
  notificationTitle: 'Tracking active',
  notificationText: 'Sharing location in the background',
});

const remove = addLocationListener((point) => {
  console.log(point.latitude, point.longitude, point.accuracy);
});

const stored = await getSessionLocations('session-1', 50);
await clearSessionLocations('session-1');

await stopTracking();
remove();
```

### Tracking options

| Option | Default | Notes |
| --- | --- | --- |
| `intervalMs` | `30000` | Desired update interval. Android-focused; iOS uses the distance filter. |
| `fastestIntervalMs` | `15000` | Fastest Android update interval. |
| `distanceFilterM` | `25` | Minimum movement in meters between updates. |
| `accuracy` | `'high'` | `'high'` \| `'balanced'` \| `'low'` |
| `maxLocationAgeMs` | `60000` | Reject fixes older than this. |
| `notificationTitle` | `'Location tracking active'` | Android foreground-service notification. |
| `notificationText` | `'Sharing your location in the background'` | Android foreground-service notification. |

### Functions

| Function | Description |
| --- | --- |
| `requestNotificationPermission()` | Android 13+ notification permission. Always `granted` on older Android and iOS. |
| `requestLocationPermission(foregroundOnly?)` | Fine → optional background / Always. |
| `getLocationPermissionStatus()` | Current grant state without showing a dialog. |
| `startTracking(sessionId, options?)` | Starts native background tracking. |
| `stopTracking()` | Stops the Android foreground service / iOS updates. |
| `isTracking()` | `{ active, sessionId? }` |
| `getSessionLocations(sessionId, limit?)` | Persisted points, newest first. |
| `clearSessionLocations(sessionId?)` | One session, or all sessions if omitted. |
| `addLocationListener` / `addErrorListener` / `addWarningListener` | Returns an unsubscribe function. |

If start fails with `BACKGROUND_PERMISSION_REQUIRED`, send the user to Settings and grant **Allow all the time** (Android) or **Always** (iOS).

### Events

| Event | Payload |
| --- | --- |
| `location` | `{ sessionId, latitude, longitude, accuracy, speed, heading, altitude, timestamp }` |
| `error` | `{ code, message, sessionId? }` |
| `warning` | `{ code, message, sessionId? }` |

Lat/lng are **numbers**.

## Example app

```bash
yarn
yarn example android
# or
yarn example ios
```

### Manual test checklist

1. Open example → **Permissions** → grant Fine / Always / Notifications.
2. Tap **Start** — Android shows a persistent notification.
3. Press **Home** for 2+ minutes — points / logs should keep updating.
4. Open another app — tracking continues.
5. Lock the phone — tracking continues.
6. Tap **Stop** — notification clears; no new points.

## License

MIT © EchoBitz IT
