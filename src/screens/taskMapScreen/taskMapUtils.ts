import AsyncStorage from '@react-native-async-storage/async-storage';
import { Linking, Platform } from 'react-native';
import type { FieldLatLng } from '../../services/apiClient';

export type MapTypeId = 'roadmap' | 'satellite' | 'hybrid' | 'terrain';
export type TravelMode = 'driving' | 'walking' | 'bicycling';
export type AvoidOption = 'tolls' | 'highways' | 'ferries';

export type LastKnownFix = {
  latitude: number;
  longitude: number;
  heading?: number | null;
  at: number;
};

const LAST_FIX_KEY = '@geo_employee_tracker/task_map_last_fix';

export const OFF_ROUTE_THRESHOLD_M = 50;
export const OFF_ROUTE_HITS_NEEDED = 3;

export function formatEta(seconds: number): string {
  const totalMin = Math.max(0, Math.round(seconds / 60));
  if (totalMin < 60) {
    return `${totalMin} min`;
  }
  const hours = Math.floor(totalMin / 60);
  const mins = totalMin % 60;
  return mins > 0 ? `${hours} h ${mins} min` : `${hours} h`;
}

export function formatDistanceKm(km: number): string {
  if (km < 0.1) {
    return `${Math.round(km * 1000)} m`;
  }
  return `${km.toFixed(1)} km`;
}

export function formatRouteSummary(
  etaSeconds: number | null,
  distanceKm: number | null,
): string | null {
  const eta = etaSeconds != null && Number.isFinite(etaSeconds)
    ? formatEta(etaSeconds)
    : null;
  const dist =
    distanceKm != null && Number.isFinite(distanceKm)
      ? formatDistanceKm(distanceKm)
      : null;
  if (eta && dist) {
    return `${eta} · ${dist}`;
  }
  return eta ?? dist;
}

export function distanceMeters(a: FieldLatLng, b: FieldLatLng): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const earthRadiusM = 6371000;
  const dLat = toRad(b.latitude - a.latitude);
  const dLon = toRad(b.longitude - a.longitude);
  const lat1 = toRad(a.latitude);
  const lat2 = toRad(b.latitude);
  const h =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  return 2 * earthRadiusM * Math.asin(Math.min(1, Math.sqrt(h)));
}

function toRad(deg: number): number {
  return (deg * Math.PI) / 180;
}

/** Distance from a point to a segment, meters. */
function pointToSegmentMeters(
  point: FieldLatLng,
  a: FieldLatLng,
  b: FieldLatLng,
): number {
  const latScale = 111320;
  const lonScale = 111320 * Math.cos(toRad(point.latitude));
  const px = point.longitude * lonScale;
  const py = point.latitude * latScale;
  const ax = a.longitude * lonScale;
  const ay = a.latitude * latScale;
  const bx = b.longitude * lonScale;
  const by = b.latitude * latScale;
  const abx = bx - ax;
  const aby = by - ay;
  const apx = px - ax;
  const apy = py - ay;
  const abLen2 = abx * abx + aby * aby;
  const t =
    abLen2 <= 0 ? 0 : Math.max(0, Math.min(1, (apx * abx + apy * aby) / abLen2));
  const dx = px - (ax + abx * t);
  const dy = py - (ay + aby * t);
  return Math.sqrt(dx * dx + dy * dy);
}

export function minDistanceToPolylineMeters(
  point: FieldLatLng,
  path: FieldLatLng[],
): number | null {
  if (path.length === 0) {
    return null;
  }
  if (path.length === 1) {
    return distanceMeters(point, path[0]);
  }
  let min = Number.POSITIVE_INFINITY;
  for (let i = 1; i < path.length; i += 1) {
    const d = pointToSegmentMeters(point, path[i - 1], path[i]);
    if (d < min) {
      min = d;
    }
  }
  return Number.isFinite(min) ? min : null;
}

export async function saveLastKnownFix(fix: LastKnownFix): Promise<void> {
  try {
    await AsyncStorage.setItem(LAST_FIX_KEY, JSON.stringify(fix));
  } catch {
    // Best-effort cache.
  }
}

export async function loadLastKnownFix(): Promise<LastKnownFix | null> {
  try {
    const raw = await AsyncStorage.getItem(LAST_FIX_KEY);
    if (!raw) {
      return null;
    }
    const parsed = JSON.parse(raw) as LastKnownFix;
    if (
      typeof parsed?.latitude !== 'number' ||
      typeof parsed?.longitude !== 'number' ||
      !Number.isFinite(parsed.latitude) ||
      !Number.isFinite(parsed.longitude)
    ) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function formatLastKnownAge(at: number): string {
  const agoMs = Date.now() - at;
  const mins = Math.max(0, Math.round(agoMs / 60_000));
  if (mins < 1) {
    return 'just now';
  }
  if (mins < 60) {
    return `${mins} min ago`;
  }
  const hours = Math.round(mins / 60);
  return `${hours} h ago`;
}

export async function openExternalMaps(
  latitude: number,
  longitude: number,
  mode: TravelMode,
): Promise<void> {
  const dest = `${latitude},${longitude}`;
  const dirflg = mode === 'walking' ? 'w' : mode === 'bicycling' ? 'b' : 'd';
  const navMode = mode === 'walking' ? 'w' : mode === 'bicycling' ? 'b' : 'd';
  const travelmode =
    mode === 'walking'
      ? 'walking'
      : mode === 'bicycling'
        ? 'bicycling'
        : 'driving';
  const fallback = `https://www.google.com/maps/dir/?api=1&destination=${dest}&travelmode=${travelmode}`;

  try {
    if (Platform.OS === 'ios') {
      const apple = `maps://?daddr=${dest}&dirflg=${dirflg}`;
      if (await Linking.canOpenURL(apple)) {
        await Linking.openURL(apple);
        return;
      }
    } else {
      const googleNav = `google.navigation:q=${dest}&mode=${navMode}`;
      if (await Linking.canOpenURL(googleNav)) {
        await Linking.openURL(googleNav);
        return;
      }
    }
  } catch {
    // Fall through to HTTPS.
  }
  await Linking.openURL(fallback);
}
