# @eb/react-native-background-location

Standalone React Native **TurboModule** for background GPS tracking.

- **Android:** Foreground Service (`location`) + Fused Location Provider
- **iOS:** `CLLocationManager` with Always + background updates
- **Not** wired to any host product app — use the `example/` harness to test

Inspired by patterns in [@gabriel-sisjr/react-native-background-location](https://github.com/gabriel-sisjr/react-native-background-location) (MIT). This package is an independent slim implementation (no geofencing / Expo / trip DB).

## Requirements

| Requirement | Version |
| --- | --- |
| React Native | >= 0.73 (New Architecture) |
| Android minSdk | 24 |
| iOS | 16+ |

## Install (local)

```bash
cd /home/deep-patel/Application123/eb-background-location
yarn
```

## API

```ts
import {
  requestLocationPermission,
  requestNotificationPermission,
  startTracking,
  stopTracking,
  isTracking,
  addLocationListener,
  addErrorListener,
  addWarningListener,
} from 'react-native-background-location';

await requestNotificationPermission();
await requestLocationPermission(false); // When In Use → Always / Background

await startTracking('session-1', {
  intervalMs: 30000,
  fastestIntervalMs: 15000,
  distanceFilterM: 25,
  notificationTitle: 'Tracking active',
  notificationText: 'Sharing location in the background',
});

const remove = addLocationListener((point) => {
  console.log(point.latitude, point.longitude, point.accuracy);
});

await stopTracking();
remove();
```

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

## Project layout

```text
src/           JS API + TurboModule Spec
android/       FGS + Fused Location + TrackingStateStore
ios/           Swift CLLocationManager wrapper + ObjC++ TurboModule
example/       Standalone test app (not a product app)
```

## License

MIT
