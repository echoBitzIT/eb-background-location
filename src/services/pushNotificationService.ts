import { Platform } from 'react-native';
import notifee, { AndroidImportance } from '@notifee/react-native';
import {
  getMessaging,
  requestPermission,
  registerDeviceForRemoteMessages,
  getToken,
  onTokenRefresh,
  onMessage,
  AuthorizationStatus,
  type FirebaseMessagingTypes,
} from '@react-native-firebase/messaging';
import {
  fieldRegisterDeviceToken,
  fieldUnregisterDeviceToken,
  type FieldDevicePlatform,
} from './apiClient';
import { getAuthSessionBridge } from './authSessionBridge';
import { isNotificationPermissionGranted } from '../utils/notificationGate';

const messaging = getMessaging();

const NO_MOVEMENT_CHANNEL_ID = 'no_movement';
const DEFAULT_NO_MOVEMENT_BODY = 'No movement detected.';

let lastRegisteredToken: string | null = null;
let tokenRefreshUnsubscribe: (() => void) | null = null;
let foregroundUnsubscribe: (() => void) | null = null;
let handlersAttached = false;
let channelReady = false;

function platformForFcm(): FieldDevicePlatform {
  return Platform.OS === 'ios' ? 'ios' : 'android';
}

function tokenPreview(token: string): string {
  return token.length <= 12 ? token : `${token.slice(0, 12)}…`;
}

function logFcm(event: string, payload?: Record<string, unknown>): void {
  if (!__DEV__) {
    return;
  }
  if (payload !== undefined) {
    console.log('[FCM]', event, payload);
  } else {
    console.log('[FCM]', event);
  }
}

function asStringData(
  data?: Record<string, string | object | number> | undefined,
): Record<string, string> | undefined {
  if (!data) {
    return undefined;
  }
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(data)) {
    if (value == null) {
      continue;
    }
    out[key] = typeof value === 'string' ? value : String(value);
  }
  return out;
}

function isNoMovementMessage(
  data?: Record<string, string> | undefined,
): boolean {
  return data?.type === 'no_movement_employee';
}

async function ensureNoMovementChannel(): Promise<void> {
  if (channelReady || Platform.OS !== 'android') {
    return;
  }
  await notifee.deleteChannel(NO_MOVEMENT_CHANNEL_ID);
  await notifee.createChannel({
    id: NO_MOVEMENT_CHANNEL_ID,
    name: 'No movement alerts',
    importance: AndroidImportance.HIGH,
    sound: 'default',
    vibration: true,
  });
  channelReady = true;
}

/** Show tray title/body only — same idea as Odoo simple_notification. */
async function displayNoMovementTray(
  message: FirebaseMessagingTypes.RemoteMessage,
): Promise<void> {
  const data = asStringData(message.data as Record<string, string> | undefined);
  const titleRaw = message.notification?.title?.trim();
  const bodyRaw = message.notification?.body?.trim();

  logFcm('foreground message', {
    type: data?.type,
    title: titleRaw,
    body: bodyRaw,
    data,
  });

  if (!isNoMovementMessage(data)) {
    logFcm('foreground ignored', { type: data?.type });
    return;
  }

  await ensureNoMovementChannel();

  const title = titleRaw || 'No Movement Detected';
  const body = bodyRaw || DEFAULT_NO_MOVEMENT_BODY;

  await notifee.displayNotification({
    title,
    body,
    data,
    android: {
      channelId: NO_MOVEMENT_CHANNEL_ID,
      sound: 'default',
      vibrationPattern: [300, 500],
      pressAction: { id: 'default' },
    },
  });

  logFcm('tray displayed', { title, body });
}

/**
 * Register early (index.js). Background presses are no-ops for tray-only
 * alerts; the handler must still be registered for Notifee on Android.
 */
export function registerNotifeeBackgroundHandler(): void {
  notifee.onBackgroundEvent(async () => {
    // Tray-only: dismiss / tap does not open a dedicated screen.
  });
}

/** Register token with Odoo when notification permission is already granted. */
export async function registerPushForSession(accessToken: string): Promise<void> {
  try {
    const permitted = await isNotificationPermissionGranted();
    if (!permitted) {
      logFcm('token register skipped', { reason: 'permission_denied' });
      return;
    }

    // Sync FCM/APNs after the OS dialog was already answered (no second prompt).
    if (Platform.OS === 'ios') {
      const authStatus = await requestPermission(messaging);
      const enabled =
        authStatus === AuthorizationStatus.AUTHORIZED ||
        authStatus === AuthorizationStatus.PROVISIONAL;
      if (!enabled) {
        logFcm('token register skipped', { reason: 'permission_denied', authStatus });
        return;
      }
    }

    await ensureNoMovementChannel();

    if (Platform.OS === 'ios') {
      await registerDeviceForRemoteMessages(messaging);
    }
    const token = await getToken(messaging);
    if (!token) {
      logFcm('token register skipped', { reason: 'empty_token' });
      return;
    }
    await fieldRegisterDeviceToken(accessToken, {
      token,
      platform: platformForFcm(),
    });
    lastRegisteredToken = token;
    logFcm('token registered', {
      platform: platformForFcm(),
      tokenPreview: tokenPreview(token),
    });

    tokenRefreshUnsubscribe?.();
    tokenRefreshUnsubscribe = onTokenRefresh(messaging, async (newToken) => {
      try {
        const bridge = getAuthSessionBridge();
        const freshToken = bridge?.getAccessToken() ?? accessToken;
        if (!freshToken) {
          logFcm('token refresh skipped', { reason: 'no_access_token' });
          return;
        }
        await fieldRegisterDeviceToken(freshToken, {
          token: newToken,
          platform: platformForFcm(),
        });
        lastRegisteredToken = newToken;
        logFcm('token refresh', {
          platform: platformForFcm(),
          tokenPreview: tokenPreview(newToken),
        });
      } catch {
        // Best-effort; next login/session restore will retry.
      }
    });
  } catch {
    // Push is additive — never block login/session restore.
  }
}

/** Deactivate the current device token on logout. */
export async function unregisterPushForSession(accessToken: string | null): Promise<void> {
  try {
    tokenRefreshUnsubscribe?.();
    tokenRefreshUnsubscribe = null;
    if (!accessToken) {
      logFcm('token unregister', { skipped: true, reason: 'no_access_token' });
      lastRegisteredToken = null;
      return;
    }
    const preview = lastRegisteredToken
      ? tokenPreview(lastRegisteredToken)
      : undefined;
    await fieldUnregisterDeviceToken(
      accessToken,
      lastRegisteredToken || undefined,
    );
    logFcm('token unregister', { tokenPreview: preview });
  } catch {
    // Best-effort logout cleanup.
  } finally {
    lastRegisteredToken = null;
  }
}

/** Attach foreground tray handler (no navigation). */
export function attachPushNotificationHandlers(): void {
  if (handlersAttached) {
    return;
  }
  handlersAttached = true;

  foregroundUnsubscribe = onMessage(messaging, async (message) => {
    try {
      await displayNoMovementTray(message);
    } catch {
      // Never block the JS thread on notification display failures.
    }
  });
}

export function detachPushNotificationHandlers(): void {
  foregroundUnsubscribe?.();
  foregroundUnsubscribe = null;
  handlersAttached = false;
}
