import { Platform } from 'react-native';
import {
  checkNotifications,
  requestNotifications,
  RESULTS,
  type PermissionStatus,
} from 'react-native-permissions';

function isPermissionGranted(status: PermissionStatus): boolean {
  return status === RESULTS.GRANTED || status === RESULTS.LIMITED;
}

/**
 * Check-only. Does not show the OS dialog.
 */
export async function isNotificationPermissionGranted(): Promise<boolean> {
  try {
    const { status } = await checkNotifications();
    return isPermissionGranted(status);
  } catch {
    return false;
  }
}

/**
 * Soft OS ask: show the system notification dialog once if undecided.
 * Returns whether notifications are allowed. Never throws, never alerts.
 * Caller should always continue — deny does not block the app.
 */
export async function askNotificationPermission(): Promise<boolean> {
  try {
    console.log('[NotifPerm] ask start', {
      os: Platform.OS,
      version: Platform.Version,
    });

    const current = await checkNotifications();
    console.log('[NotifPerm] check', { status: current.status });

    if (isPermissionGranted(current.status)) {
      console.log('[NotifPerm] skip request — already granted');
      return true;
    }

    if (current.status === RESULTS.DENIED) {
      console.log('[NotifPerm] showing OS dialog');
      const next = await requestNotifications(['alert', 'sound', 'badge']);
      console.log('[NotifPerm] after request', { status: next.status });
      return isPermissionGranted(next.status);
    }

    console.log('[NotifPerm] no dialog', {
      status: current.status,
      reason: 'blocked_or_unavailable',
    });
    return false;
  } catch (error) {
    console.log('[NotifPerm] ask failed', error);
    return false;
  }
}
