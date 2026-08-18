import { Platform, PermissionsAndroid } from 'react-native';
import NativeBackgroundLocation from './NativeBackgroundLocation';
import type { TrackingOptionsSpec } from './NativeBackgroundLocation';
import type {
  LocationPoint,
  PermissionResult,
  PermissionStatus,
  TrackingOptions,
  TrackingStatus,
} from './types';

export type {
  LocationAccuracy,
  LocationErrorEvent,
  LocationPoint,
  LocationWarningCode,
  LocationWarningEvent,
  PermissionResult,
  PermissionStatus,
  TrackingOptions,
  TrackingStatus,
} from './types';

export {
  addLocationListener,
  addErrorListener,
  addWarningListener,
} from './events';

const DEFAULT_OPTIONS: Required<
  Pick<
    TrackingOptions,
    | 'intervalMs'
    | 'fastestIntervalMs'
    | 'distanceFilterM'
    | 'accuracy'
    | 'maxLocationAgeMs'
    | 'notificationTitle'
    | 'notificationText'
  >
> = {
  intervalMs: 30_000,
  fastestIntervalMs: 15_000,
  distanceFilterM: 25,
  accuracy: 'high',
  maxLocationAgeMs: 60_000,
  notificationTitle: 'Location tracking active',
  notificationText: 'Sharing your location in the background',
};

function toSpec(options?: TrackingOptions): TrackingOptionsSpec {
  const merged = { ...DEFAULT_OPTIONS, ...options };
  return {
    intervalMs: merged.intervalMs,
    fastestIntervalMs: merged.fastestIntervalMs,
    distanceFilterM: merged.distanceFilterM,
    accuracy: merged.accuracy,
    maxLocationAgeMs: merged.maxLocationAgeMs,
    notificationTitle: merged.notificationTitle,
    notificationText: merged.notificationText,
  };
}

function mapLocationPoint(raw: {
  sessionId: string;
  latitude: number;
  longitude: number;
  accuracy?: number | null;
  speed?: number | null;
  heading?: number | null;
  altitude?: number | null;
  timestamp: number;
}): LocationPoint {
  return {
    sessionId: String(raw.sessionId),
    latitude: Number(raw.latitude),
    longitude: Number(raw.longitude),
    accuracy:
      raw.accuracy == null || Number.isNaN(Number(raw.accuracy))
        ? null
        : Number(raw.accuracy),
    speed:
      raw.speed == null || Number.isNaN(Number(raw.speed))
        ? null
        : Number(raw.speed),
    heading:
      raw.heading == null || Number.isNaN(Number(raw.heading))
        ? null
        : Number(raw.heading),
    altitude:
      raw.altitude == null || Number.isNaN(Number(raw.altitude))
        ? null
        : Number(raw.altitude),
    timestamp: Number(raw.timestamp),
  };
}

function mapPermissionStatus(status: string): PermissionStatus {
  switch (status) {
    case 'granted':
    case 'whenInUse':
    case 'denied':
    case 'blocked':
    case 'undetermined':
      return status;
    default:
      return 'undetermined';
  }
}

/**
 * Starts native background location tracking for a session.
 */
export async function startTracking(
  sessionId: string,
  options?: TrackingOptions
): Promise<void> {
  if (!sessionId) {
    throw new Error('sessionId is required');
  }
  const spec = toSpec(options);
  console.log('[EBBgLoc]', '[Lib] startTracking', { sessionId, options: spec });
  await NativeBackgroundLocation.startTracking(sessionId, spec);
}

/**
 * Stops tracking and tears down the Android foreground service / iOS updates.
 */
export async function stopTracking(): Promise<void> {
  console.log('[EBBgLoc]', '[Lib] stopTracking');
  await NativeBackgroundLocation.stopTracking();
}

/**
 * Returns whether tracking is currently active.
 */
export async function isTracking(): Promise<TrackingStatus> {
  const result = await NativeBackgroundLocation.isTracking();
  const status = {
    active: Boolean(result.active),
    sessionId: result.sessionId,
  };
  console.log('[EBBgLoc]', '[Lib] isTracking', status);
  return status;
}

/**
 * Returns current location permission status without showing a system dialog.
 */
export async function getLocationPermissionStatus(): Promise<PermissionResult> {
  if (Platform.OS === 'android') {
    return await getAndroidLocationPermissionStatus();
  }

  const result = await NativeBackgroundLocation.getLocationPermissionStatus();
  const mapped = {
    status: mapPermissionStatus(result.status),
    canRequestAgain: Boolean(result.canRequestAgain),
  };
  console.log('[EBBgLoc]', '[Lib] getLocationPermissionStatus', mapped);
  return mapped;
}

/**
 * Returns persisted locations for a session (newest first).
 */
export async function getSessionLocations(
  sessionId: string,
  limit?: number
): Promise<LocationPoint[]> {
  const rows = await NativeBackgroundLocation.getSessionLocations(
    sessionId,
    limit
  );
  const points = rows.map((row) => mapLocationPoint(row));
  console.log('[EBBgLoc]', '[Lib] getSessionLocations', {
    sessionId,
    count: points.length,
  });
  return points;
}

/**
 * Clears persisted locations for one session or all sessions.
 */
export async function clearSessionLocations(sessionId?: string): Promise<void> {
  console.log('[EBBgLoc]', '[Lib] clearSessionLocations', { sessionId });
  if (sessionId != null && sessionId.length > 0) {
    await NativeBackgroundLocation.clearSessionLocations(sessionId);
  } else {
    await NativeBackgroundLocation.clearSessionLocations(undefined);
  }
}

/**
 * Requests location permission.
 * Android: uses PermissionsAndroid (fine → optional background).
 * iOS: uses native CLLocationManager (When In Use → optional Always).
 */
export async function requestLocationPermission(
  foregroundOnly: boolean = false
): Promise<PermissionResult> {
  console.log('[EBBgLoc]', '[Lib] requestLocationPermission', {
    foregroundOnly,
    platform: Platform.OS,
  });
  if (Platform.OS === 'android') {
    return requestAndroidLocationPermission(foregroundOnly);
  }

  const result =
    await NativeBackgroundLocation.requestLocationPermission(foregroundOnly);
  const mapped = {
    status: mapPermissionStatus(result.status),
    canRequestAgain: Boolean(result.canRequestAgain),
  };
  console.log('[EBBgLoc]', '[Lib] requestLocationPermission result', mapped);
  return mapped;
}

/**
 * Requests notification permission (Android 13+). Always granted on older Android / iOS.
 */
export async function requestNotificationPermission(): Promise<
  'granted' | 'denied'
> {
  console.log('[EBBgLoc]', '[Lib] requestNotificationPermission', {
    platform: Platform.OS,
    version: Platform.Version,
  });
  if (Platform.OS === 'android' && Number(Platform.Version) >= 33) {
    const result = await PermissionsAndroid.request(
      PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS
    );
    const status =
      result === PermissionsAndroid.RESULTS.GRANTED ? 'granted' : 'denied';
    console.log(
      '[EBBgLoc]',
      '[Lib] requestNotificationPermission result',
      status
    );
    return status;
  }

  if (Platform.OS === 'android') {
    console.log(
      '[EBBgLoc]',
      '[Lib] requestNotificationPermission result granted (pre-33)'
    );
    return 'granted';
  }

  const status = await NativeBackgroundLocation.requestNotificationPermission();
  const mapped = status === 'granted' ? 'granted' : 'denied';
  console.log(
    '[EBBgLoc]',
    '[Lib] requestNotificationPermission result',
    mapped
  );
  return mapped;
}

async function requestAndroidLocationPermission(
  foregroundOnly: boolean
): Promise<PermissionResult> {
  const fine = await PermissionsAndroid.request(
    PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION
  );
  console.log('[EBBgLoc]', '[Lib] Android ACCESS_FINE_LOCATION', fine);
  const coarse = await PermissionsAndroid.request(
    PermissionsAndroid.PERMISSIONS.ACCESS_COARSE_LOCATION
  );
  console.log('[EBBgLoc]', '[Lib] Android ACCESS_COARSE_LOCATION', coarse);

  const fgGranted =
    fine === PermissionsAndroid.RESULTS.GRANTED ||
    coarse === PermissionsAndroid.RESULTS.GRANTED;

  if (!fgGranted) {
    const blocked =
      fine === PermissionsAndroid.RESULTS.NEVER_ASK_AGAIN ||
      coarse === PermissionsAndroid.RESULTS.NEVER_ASK_AGAIN;
    const result: PermissionResult = {
      status: blocked ? 'blocked' : 'denied',
      canRequestAgain: !blocked,
    };
    console.log(
      '[EBBgLoc]',
      '[Lib] Android location permission result',
      result
    );
    return result;
  }

  if (foregroundOnly || Number(Platform.Version) < 29) {
    const result: PermissionResult = {
      status: 'granted',
      canRequestAgain: true,
    };
    console.log(
      '[EBBgLoc]',
      '[Lib] Android location permission result',
      result
    );
    return result;
  }

  const background = await PermissionsAndroid.request(
    PermissionsAndroid.PERMISSIONS.ACCESS_BACKGROUND_LOCATION
  );
  console.log(
    '[EBBgLoc]',
    '[Lib] Android ACCESS_BACKGROUND_LOCATION',
    background
  );

  if (background === PermissionsAndroid.RESULTS.GRANTED) {
    const result: PermissionResult = {
      status: 'granted',
      canRequestAgain: true,
    };
    console.log(
      '[EBBgLoc]',
      '[Lib] Android location permission result',
      result
    );
    return result;
  }

  const blocked = background === PermissionsAndroid.RESULTS.NEVER_ASK_AGAIN;
  const result: PermissionResult = {
    // Fine granted but background missing — still usable in foreground-only mode.
    status: blocked ? 'blocked' : 'whenInUse',
    canRequestAgain: !blocked,
  };
  console.log('[EBBgLoc]', '[Lib] Android location permission result', result);
  return result;
}

async function getAndroidLocationPermissionStatus(): Promise<PermissionResult> {
  const fine = await PermissionsAndroid.check(
    PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION
  );
  const coarse = await PermissionsAndroid.check(
    PermissionsAndroid.PERMISSIONS.ACCESS_COARSE_LOCATION
  );
  const fgGranted = fine || coarse;

  if (!fgGranted) {
    const result: PermissionResult = {
      status: 'denied',
      canRequestAgain: true,
    };
    console.log('[EBBgLoc]', '[Lib] getLocationPermissionStatus', result);
    return result;
  }

  if (Number(Platform.Version) < 29) {
    const result: PermissionResult = {
      status: 'granted',
      canRequestAgain: true,
    };
    console.log('[EBBgLoc]', '[Lib] getLocationPermissionStatus', result);
    return result;
  }

  const background = await PermissionsAndroid.check(
    PermissionsAndroid.PERMISSIONS.ACCESS_BACKGROUND_LOCATION
  );

  const result: PermissionResult = background
    ? { status: 'granted', canRequestAgain: true }
    : { status: 'whenInUse', canRequestAgain: true };
  console.log('[EBBgLoc]', '[Lib] getLocationPermissionStatus', result);
  return result;
}
