# Firebase setup (no-movement FCM push)

One Firebase project covers Android and iOS. Do this once before push works on devices.

## 1. Create the project

1. Open [Firebase Console](https://console.firebase.google.com/).
2. Create a project (e.g. `eb-geo-employee-tracker`).
3. Analytics is optional for push-only use.

## 2. Android app

1. Add an Android app with package name exactly:
   `com.eb_geoemployee_tracker_mobile`
2. Download `google-services.json`.
3. Place it at:
   `android/app/google-services.json`
4. Do **not** commit a production service-account private key. The client `google-services.json` is normally committed for RN Firebase; follow your company policy.

## 3. iOS app

1. Set a real `PRODUCT_BUNDLE_IDENTIFIER` in Xcode (replace the RN example id).
2. Add an iOS app in Firebase with that same bundle id.
3. Download `GoogleService-Info.plist` into the iOS app target.
4. Enable **Push Notifications** capability and remote-notification background mode.
5. In Apple Developer, create an APNs Auth Key (`.p8`).
6. Firebase Console → Project settings → Cloud Messaging → upload the APNs key (Key ID + Team ID).

## 4. Odoo server credentials (send pushes)

1. Firebase Console → Project settings → Service accounts → Generate new private key.
2. In Odoo: Settings → Technical → System Parameters (or Field Tracking settings):

| Key | Value |
|-----|--------|
| `eb_field_tracking.fcm_project_id` | Firebase project id (e.g. `eb-geo-employee-tracker`) |
| `eb_field_tracking.fcm_service_account_json` | Full JSON contents of the service-account key file |

Never commit the service-account JSON into git.

## Placeholder configs in this repo

The repo ships placeholder files so the app builds before your Firebase
project exists:

* `android/app/google-services.json` — replace with the real Android file
* `ios/eb_geoemployee_tracker_mobile/GoogleService-Info.plist` — replace with the real iOS file

Until you replace them and set Odoo FCM system parameters, device registration
may fail or pushes will not deliver.

## 5. Verify

1. Log in on a real device → an `eb.mobile.device` row appears.
2. Trigger no-movement (or call `env['eb.push.service'].send_to_employees(...)` from the Odoo shell).
3. Confirm the lock-screen / tray notification arrives.

