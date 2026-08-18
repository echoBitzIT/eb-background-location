import AsyncStorage from '@react-native-async-storage/async-storage';
import { fetchFieldSession } from './apiClient';
import { applyLocationTrackingIntervalFromApi } from './applyLocationTrackingInterval';
import {
  startLocationTracking,
  stopLocationTracking,
} from './locationTrackingService';

export const ATTENDANCE_STORAGE_KEY = '@geo_employee_tracker/attendance';

export type PersistedAttendance = {
  isCheckedIn: boolean;
  sessionId: number | null;
  trackingSessionId: number | null;
  isTrackingActive: boolean;
  checkInAt: string | null;
  checkOutAt: string | null;
  activeTaskId: number | null;
  activeTaskState: string | null;
  activeTaskStopId: number | null;
};

export type SyncAttendanceOptions = {
  force?: boolean;
};

const EMPTY_ATTENDANCE: PersistedAttendance = {
  isCheckedIn: false,
  sessionId: null,
  trackingSessionId: null,
  isTrackingActive: false,
  checkInAt: null,
  checkOutAt: null,
  activeTaskId: null,
  activeTaskState: null,
  activeTaskStopId: null,
};

/** Short TTL so Home / CheckIn / DefaultRoute focus do not hammer field/session. */
const SESSION_SYNC_TTL_MS = 15_000;

let sessionSyncCache: PersistedAttendance | null = null;
let sessionSyncCachedAt = 0;
let sessionSyncInFlight: Promise<PersistedAttendance> | null = null;

/** Drop cached session sync (after check-in/out, start/stop tracking, logout). */
export function invalidateAttendanceSyncCache(): void {
  sessionSyncCache = null;
  sessionSyncCachedAt = 0;
  // Keep in-flight request; it will refresh the cache when it settles.
}

function rememberSyncResult(result: PersistedAttendance): PersistedAttendance {
  sessionSyncCache = result;
  sessionSyncCachedAt = Date.now();
  return result;
}

export async function loadAttendance(): Promise<PersistedAttendance> {
  const raw = await AsyncStorage.getItem(ATTENDANCE_STORAGE_KEY);
  if (!raw) {
    return { ...EMPTY_ATTENDANCE };
  }
  try {
    const parsed = JSON.parse(raw) as Partial<PersistedAttendance>;
    return {
      isCheckedIn: Boolean(parsed.isCheckedIn),
      sessionId:
        typeof parsed.sessionId === 'number' ? parsed.sessionId : null,
      trackingSessionId:
        typeof parsed.trackingSessionId === 'number'
          ? parsed.trackingSessionId
          : null,
      isTrackingActive: Boolean(parsed.isTrackingActive),
      checkInAt:
        typeof parsed.checkInAt === 'string' ? parsed.checkInAt : null,
      checkOutAt:
        typeof parsed.checkOutAt === 'string' ? parsed.checkOutAt : null,
      activeTaskId:
        typeof parsed.activeTaskId === 'number' ? parsed.activeTaskId : null,
      activeTaskState:
        typeof parsed.activeTaskState === 'string'
          ? parsed.activeTaskState
          : null,
      activeTaskStopId:
        typeof parsed.activeTaskStopId === 'number'
          ? parsed.activeTaskStopId
          : null,
    };
  } catch {
    return { ...EMPTY_ATTENDANCE };
  }
}

export async function saveAttendance(
  attendance: PersistedAttendance,
): Promise<void> {
  await AsyncStorage.setItem(
    ATTENDANCE_STORAGE_KEY,
    JSON.stringify(attendance),
  );
}

export async function clearAttendance(): Promise<void> {
  invalidateAttendanceSyncCache();
  await AsyncStorage.removeItem(ATTENDANCE_STORAGE_KEY);
}

export async function markCheckedIn(params: {
  attendanceId: number;
  checkInAt: string;
}): Promise<PersistedAttendance> {
  invalidateAttendanceSyncCache();
  const next: PersistedAttendance = {
    isCheckedIn: true,
    // Persist attendance id in sessionId for storage compatibility.
    sessionId: params.attendanceId,
    trackingSessionId: null,
    isTrackingActive: false,
    checkInAt: params.checkInAt,
    checkOutAt: null,
    activeTaskId: null,
    activeTaskState: null,
    activeTaskStopId: null,
  };
  await saveAttendance(next);
  return rememberSyncResult(next);
}

export async function markCheckedOut(params: {
  sessionId: number;
  checkInAt: string | null;
  checkOutAt: string;
}): Promise<PersistedAttendance> {
  invalidateAttendanceSyncCache();
  const next: PersistedAttendance = {
    isCheckedIn: false,
    sessionId: params.sessionId,
    trackingSessionId: null,
    isTrackingActive: false,
    checkInAt: params.checkInAt,
    checkOutAt: params.checkOutAt,
    activeTaskId: null,
    activeTaskState: null,
    activeTaskStopId: null,
  };
  await saveAttendance(next);
  return rememberSyncResult(next);
}

export async function markTrackingActive(params: {
  attendanceId: number;
  trackingSessionId: number;
  checkInAt: string;
}): Promise<PersistedAttendance> {
  invalidateAttendanceSyncCache();
  const next: PersistedAttendance = {
    isCheckedIn: true,
    sessionId: params.attendanceId,
    trackingSessionId: params.trackingSessionId,
    isTrackingActive: true,
    checkInAt: params.checkInAt,
    checkOutAt: null,
    activeTaskId: null,
    activeTaskState: null,
    activeTaskStopId: null,
  };
  await saveAttendance(next);
  return rememberSyncResult(next);
}

export async function markTrackingInactive(
  current: PersistedAttendance,
): Promise<PersistedAttendance> {
  invalidateAttendanceSyncCache();
  const next: PersistedAttendance = {
    ...current,
    trackingSessionId: null,
    isTrackingActive: false,
  };
  await saveAttendance(next);
  return rememberSyncResult(next);
}

function activeTaskFromSession(session: {
  active_task_id?: number | false;
  active_task_state?: string | false;
  active_task_stop_id?: number | false;
}): Pick<
  PersistedAttendance,
  'activeTaskId' | 'activeTaskState' | 'activeTaskStopId'
> {
  return {
    activeTaskId:
      typeof session.active_task_id === 'number' ? session.active_task_id : null,
    activeTaskState:
      typeof session.active_task_state === 'string'
        ? session.active_task_state
        : null,
    activeTaskStopId:
      typeof session.active_task_stop_id === 'number'
        ? session.active_task_stop_id
        : null,
  };
}

async function syncAttendanceFromServerNetwork(
  accessToken: string,
): Promise<PersistedAttendance> {
  try {
    // No AbortSignal here: focus screens share in-flight via TTL dedupe;
    // aborting one screen must not cancel another's join.
    const result = await fetchFieldSession(accessToken);
    if (result.locationTrackingIntervalSeconds != null) {
      await applyLocationTrackingIntervalFromApi(
        result.locationTrackingIntervalSeconds,
      );
    }
    const session = result.status;
    if (!session) {
      await clearAttendance();
      await stopLocationTracking();
      return rememberSyncResult({ ...EMPTY_ATTENDANCE });
    }

    const activeTask = activeTaskFromSession(session);
    const hasActiveTracking =
      typeof session.session_id === 'number' &&
      session.session_state === 'active';

    if (hasActiveTracking) {
      await startLocationTracking(accessToken);
      const next: PersistedAttendance = {
        isCheckedIn: true,
        sessionId: session.attendance_id,
        trackingSessionId: session.session_id as number,
        isTrackingActive: true,
        checkInAt: session.check_in,
        checkOutAt: null,
        ...activeTask,
      };
      await saveAttendance(next);
      return rememberSyncResult(next);
    }

    await stopLocationTracking();
    const next: PersistedAttendance = {
      isCheckedIn: true,
      sessionId: session.attendance_id,
      trackingSessionId: null,
      isTrackingActive: false,
      checkInAt: session.check_in,
      checkOutAt: null,
      ...activeTask,
    };
    await saveAttendance(next);
    return rememberSyncResult(next);
  } catch {
    const local = await loadAttendance();
    return local;
  }
}

/**
 * Rehydrate local attendance from Odoo; fall back to local on network failure.
 * Uses a short TTL + in-flight dedupe so focus-driven screens share one GET.
 */
export async function syncAttendanceFromServer(
  accessToken: string,
  opts?: SyncAttendanceOptions,
): Promise<PersistedAttendance> {
  const force = Boolean(opts?.force);
  const now = Date.now();

  if (
    !force &&
    sessionSyncCache &&
    now - sessionSyncCachedAt < SESSION_SYNC_TTL_MS
  ) {
    return sessionSyncCache;
  }

  if (!force && sessionSyncInFlight) {
    return sessionSyncInFlight;
  }

  const request = syncAttendanceFromServerNetwork(accessToken).finally(() => {
    if (sessionSyncInFlight === request) {
      sessionSyncInFlight = null;
    }
  });

  sessionSyncInFlight = request;
  return request;
}
