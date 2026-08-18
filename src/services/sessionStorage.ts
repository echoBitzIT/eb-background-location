import AsyncStorage from '@react-native-async-storage/async-storage';
import type { MobileEmployee } from './apiClient';
import { clearAttendance } from './attendanceStorage';
import {
  normalizeLocationTrackingIntervalSeconds,
  stopLocationTracking,
} from './locationTrackingService';

export const SESSION_STORAGE_KEY = '@geo_employee_tracker/session';
export const ODOO_BASE_URL_KEY = '@geo_employee_tracker/odoo_base_url';

/** Clock skew allowance when checking access-token expiry (ms). */
const EXPIRY_SKEW_MS = 30_000;

export type PersistedSession = {
  accessToken: string;
  refreshToken: string;
  accessTokenExpiresAt: string | null;
  employee: MobileEmployee;
  website: string;
  companyName: string | null;
  companyLogo: string | false | null;
  locationTrackingIntervalSeconds: number;
};

export async function saveSession(session: PersistedSession): Promise<void> {
  await AsyncStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(session));
}

export async function persistLocationTrackingInterval(
  seconds: number,
): Promise<void> {
  const session = await loadSession();
  if (!session) {
    return;
  }
  const locationTrackingIntervalSeconds =
    normalizeLocationTrackingIntervalSeconds(seconds);
  if (session.locationTrackingIntervalSeconds === locationTrackingIntervalSeconds) {
    return;
  }
  await saveSession({ ...session, locationTrackingIntervalSeconds });
}

export async function loadSession(): Promise<PersistedSession | null> {
  const raw = await AsyncStorage.getItem(SESSION_STORAGE_KEY);
  if (!raw) {
    return null;
  }
  try {
    const parsed = JSON.parse(raw) as PersistedSession & {
      /** Legacy field-tracking session shape. */
      apiKey?: string;
    };
    // Drop pre-REST sessions that still store mobile api_key only.
    if (!parsed.accessToken || !parsed.refreshToken) {
      return null;
    }
    parsed.locationTrackingIntervalSeconds =
      normalizeLocationTrackingIntervalSeconds(
        parsed.locationTrackingIntervalSeconds,
      );
    return parsed as PersistedSession;
  } catch {
    return null;
  }
}

export async function clearSession(): Promise<void> {
  await stopLocationTracking();
  await Promise.all([
    AsyncStorage.removeItem(SESSION_STORAGE_KEY),
    AsyncStorage.removeItem(ODOO_BASE_URL_KEY),
    clearAttendance(),
  ]);
}

export async function saveOdooBaseUrl(url: string): Promise<void> {
  await AsyncStorage.setItem(ODOO_BASE_URL_KEY, url);
}

export async function loadOdooBaseUrl(): Promise<string | null> {
  return AsyncStorage.getItem(ODOO_BASE_URL_KEY);
}

export async function clearOdooBaseUrl(): Promise<void> {
  await AsyncStorage.removeItem(ODOO_BASE_URL_KEY);
}

export function isAccessTokenFresh(session: PersistedSession | null): boolean {
  if (!session?.accessToken) {
    return false;
  }
  if (!session.accessTokenExpiresAt) {
    return true;
  }
  const expiresAt = new Date(session.accessTokenExpiresAt).getTime();
  if (Number.isNaN(expiresAt)) {
    return false;
  }
  return expiresAt > Date.now() + EXPIRY_SKEW_MS;
}

/** True when we can enter Home: fresh access token, or refreshable expired session. */
export function isSessionValid(session: PersistedSession | null): boolean {
  if (!session?.accessToken || !session.refreshToken) {
    return false;
  }
  if (isAccessTokenFresh(session)) {
    return true;
  }
  // Expired access token but refresh token present — splash can refresh.
  return true;
}

export function canRefreshSession(session: PersistedSession | null): boolean {
  return Boolean(session?.refreshToken) && !isAccessTokenFresh(session);
}
