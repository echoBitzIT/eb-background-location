import AsyncStorage from '@react-native-async-storage/async-storage';
import { AUTH_ERRORS } from '../constants/ApiEndpoints';
import { fieldUploadLocation } from './apiClient';
import { getCurrentCoordinates } from '../utils/locationGate';
import { createPointUuid } from '../utils/pointUuid';

export const TRACKING_ACTIVE_KEY = '@geo_employee_tracker/tracking_active';

/** Default / fallback cadence while a field tracking session is active. */
export const DEFAULT_TRACKING_INTERVAL_SECONDS = 15;

const MIN_TRACKING_INTERVAL_SECONDS = 1;
const MAX_TRACKING_INTERVAL_SECONDS = 60;

let trackingIntervalMs = DEFAULT_TRACKING_INTERVAL_SECONDS * 1000;

export function normalizeLocationTrackingIntervalSeconds(
  value?: number | null,
): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return DEFAULT_TRACKING_INTERVAL_SECONDS;
  }
  return Math.min(
    MAX_TRACKING_INTERVAL_SECONDS,
    Math.max(MIN_TRACKING_INTERVAL_SECONDS, Math.round(value)),
  );
}

/** Apply the company GPS upload interval. Restarts the loop if it is running. */
export function configureLocationTrackingInterval(seconds?: number | null): number {
  const previousMs = trackingIntervalMs;
  const normalized = normalizeLocationTrackingIntervalSeconds(seconds);
  trackingIntervalMs = normalized * 1000;
  console.log('[Location] interval:configured', {
    requested: seconds ?? null,
    seconds: normalized,
    ms: trackingIntervalMs,
  });

  if (intervalId != null && trackingIntervalMs !== previousMs) {
    clearInterval(intervalId);
    intervalId = setInterval(() => {
      void uploadCurrentPoint();
    }, trackingIntervalMs);
    console.log('[Location] tracking:start', {
      intervalSeconds: trackingIntervalMs / 1000,
      alreadyRunning: false,
    });
  }

  return normalized;
}

/** Server codes that mean the tracking session is gone — stop the loop. */
const SESSION_GONE_ERRORS = new Set([
  AUTH_ERRORS.NO_ACTIVE_SESSION,
  'FT_NO_ACTIVE_SESSION',
  'FT_SESSION_CLOSED',
]);

let intervalId: ReturnType<typeof setInterval> | null = null;
let accessToken: string | null = null;
let uploadInFlight = false;

async function setTrackingActiveFlag(active: boolean): Promise<void> {
  if (active) {
    await AsyncStorage.setItem(TRACKING_ACTIVE_KEY, '1');
  } else {
    await AsyncStorage.removeItem(TRACKING_ACTIVE_KEY);
  }
}

export async function isTrackingActiveFlag(): Promise<boolean> {
  const raw = await AsyncStorage.getItem(TRACKING_ACTIVE_KEY);
  return raw === '1';
}

export function isLocationTrackingRunning(): boolean {
  return intervalId != null;
}

/** Keep the upload loop on the latest access token after refresh. */
export function updateLocationTrackingToken(token: string | null): void {
  accessToken = token;
}

async function uploadCurrentPoint(): Promise<void> {
  if (uploadInFlight || !accessToken) {
    return;
  }

  const token = accessToken;
  uploadInFlight = true;
  try {
    const coords = await getCurrentCoordinates();
    const point: {
      point_uuid: string;
      latitude: number;
      longitude: number;
      accuracy?: number;
    } = {
      point_uuid: createPointUuid(),
      latitude: coords.latitude,
      longitude: coords.longitude,
    };
    if (coords.accuracy != null) {
      point.accuracy = coords.accuracy;
    }

    await fieldUploadLocation(token, { points: [point] });
    console.log('[Location] upload:ok', {
      point_uuid: point.point_uuid,
      latitude: point.latitude,
      longitude: point.longitude,
      intervalSeconds: trackingIntervalMs / 1000,
    });
  } catch (error) {
    const code = error instanceof Error ? error.message : '';
    if (SESSION_GONE_ERRORS.has(code)) {
      await stopLocationTracking();
      return;
    }
    console.log('[Location] upload:skip', { code });
  } finally {
    uploadInFlight = false;
  }
}

/**
 * Start foreground interval uploads for an active field tracking session.
 * No-op if already running. First live point is sent after one interval so it
 * does not duplicate the start-session opening point.
 */
export async function startLocationTracking(token: string): Promise<void> {
  accessToken = token;
  await setTrackingActiveFlag(true);

  console.log('[Location] tracking:start', {
    intervalSeconds: trackingIntervalMs / 1000,
    alreadyRunning: intervalId != null,
  });

  if (intervalId != null) {
    return;
  }

  intervalId = setInterval(() => {
    void uploadCurrentPoint();
  }, trackingIntervalMs);
}

/** Stop the interval and clear the persisted tracking-active flag. */
export async function stopLocationTracking(): Promise<void> {
  if (intervalId != null) {
    clearInterval(intervalId);
    intervalId = null;
  }
  accessToken = null;
  uploadInFlight = false;
  await setTrackingActiveFlag(false);
}
