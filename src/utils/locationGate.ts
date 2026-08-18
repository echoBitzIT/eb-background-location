import Geolocation, { PositionError } from 'react-native-geolocation-service';
import {
  check,
  PERMISSIONS,
  request,
  RESULTS,
  type Permission,
  type PermissionStatus,
} from 'react-native-permissions';
import { AppState, Linking, Platform, type AppStateStatus } from 'react-native';
import { showAlert } from '../components/common/customAlert/alertService';

function locationPermission(): Permission {
  return Platform.OS === 'ios'
    ? PERMISSIONS.IOS.LOCATION_WHEN_IN_USE
    : PERMISSIONS.ANDROID.ACCESS_FINE_LOCATION;
}

function isPermissionGranted(status: PermissionStatus): boolean {
  return status === RESULTS.GRANTED || status === RESULTS.LIMITED;
}

/**
 * System permission dialog (Android Precise / While using the app).
 * BLOCKED means the user permanently denied — cannot re-prompt; caller falls back.
 */
async function ensureLocationPermission(): Promise<boolean> {
  const permission = locationPermission();
  let status = await check(permission);

  if (isPermissionGranted(status)) {
    return true;
  }

  if (status === RESULTS.DENIED) {
    status = await request(permission);
    return isPermissionGranted(status);
  }

  return false;
}

/**
 * On Android, showLocationDialog + forceRequestLocation opens the Google Play
 * Services “Turn on” / Location Accuracy dialog when device location is off.
 * TIMEOUT means the request was accepted (services on) even without a fix yet.
 */
function enableLocationServices(): Promise<boolean> {
  return new Promise(resolve => {
    Geolocation.getCurrentPosition(
      () => resolve(true),
      error => {
        switch (error.code) {
          case PositionError.TIMEOUT:
            resolve(true);
            break;
          default:
            resolve(false);
        }
      },
      {
        enableHighAccuracy: true,
        timeout: 15_000,
        maximumAge: 0,
        showLocationDialog: true,
        forceRequestLocation: true,
      },
    );
  });
}

/**
 * Permission first, then location-services enable (native dialogs).
 * Returns false if either step fails so the caller can show a custom fallback.
 */
export async function isLocationReady(): Promise<boolean> {
  const permitted = await ensureLocationPermission();
  if (!permitted) {
    return false;
  }
  return enableLocationServices();
}

export type GeoCoordinates = {
  latitude: number;
  longitude: number;
  accuracy: number | null;
  heading: number | null;
};

/**
 * Ensure GPS permission/services, then return the current device position.
 * Throws when permission is denied or the fix cannot be obtained.
 */
export async function getCurrentCoordinates(): Promise<GeoCoordinates> {
  const ready = await isLocationReady();
  if (!ready) {
    throw new Error('location_unavailable');
  }

  return new Promise((resolve, reject) => {
    Geolocation.getCurrentPosition(
      position => {
        resolve({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracy:
            typeof position.coords.accuracy === 'number'
              ? position.coords.accuracy
              : null,
          heading:
            typeof position.coords.heading === 'number' &&
            position.coords.heading >= 0
              ? position.coords.heading
              : null,
        });
      },
      () => reject(new Error('location_unavailable')),
      {
        enableHighAccuracy: true,
        timeout: 20_000,
        maximumAge: 5_000,
        showLocationDialog: true,
        forceRequestLocation: true,
      },
    );
  });
}

export type WaitUntilGpsReadyHandle = {
  promise: Promise<boolean>;
  cancel: () => void;
};

/**
 * Runs native permission + Turn-on GPS dialogs first.
 * Only if those fail (blocked permission / No thanks / still off) shows a
 * custom Location Required alert with Retry / Open Settings.
 */
export function waitUntilGpsReady(): WaitUntilGpsReadyHandle {
  let settled = false;
  let alertVisible = false;
  let leftForSettings = false;
  let appStateSub: { remove: () => void } | null = null;
  let resolvePromise: (ready: boolean) => void = () => {};

  const cleanup = () => {
    appStateSub?.remove();
    appStateSub = null;
  };

  const finish = (ready: boolean) => {
    if (settled) {
      return;
    }
    settled = true;
    cleanup();
    resolvePromise(ready);
  };

  const checkAndMaybeAlert = async () => {
    if (settled) {
      return;
    }

    // Native permission dialog → Play Services Turn on (Android) when needed.
    const ready = await isLocationReady();
    if (settled) {
      return;
    }

    if (ready) {
      finish(true);
      return;
    }

    // Last resort: custom alert (permanent deny or user dismissed Turn on).
    if (alertVisible) {
      return;
    }

    alertVisible = true;
    showAlert({
      title: 'Location Required',
      message: 'Please enable GPS and allow location access to use this app.',
      confirmText: 'Open Settings',
      cancelText: 'Retry',
      cancelable: false,
      onConfirm: () => {
        leftForSettings = true;
        alertVisible = false;
        void Linking.openSettings();
      },
      onCancel: () => {
        alertVisible = false;
        void checkAndMaybeAlert();
      },
    });
  };

  const onAppStateChange = (nextState: AppStateStatus) => {
    if (settled || nextState !== 'active') {
      return;
    }
    // Ignore AppState flicker from Alert itself; only re-check after Settings.
    if (!leftForSettings) {
      return;
    }
    leftForSettings = false;
    alertVisible = false;
    void checkAndMaybeAlert();
  };

  const promise = new Promise<boolean>(resolve => {
    resolvePromise = resolve;
    appStateSub = AppState.addEventListener('change', onAppStateChange);
    void checkAndMaybeAlert();
  });

  return {
    promise,
    cancel: () => finish(false),
  };
}
