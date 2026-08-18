import { useEffect } from 'react';
import { useResponsive } from '../../hooks/useResponsive';
import { createStyles } from './SplashScreenStyle';
import { Image, StatusBar, StyleSheet, Text, View } from 'react-native';
import { useAppDispatch } from '../../store/hooks';
import {
  restoreSession,
  setSessionHydrated,
} from '../../store/reducers/authSlice';
import {
  accessTokenExpiresAtFromExpiresIn,
  refreshAccessToken,
  setOdooBaseUrl,
} from '../../services/apiClient';
import {
  canRefreshSession,
  clearSession,
  isAccessTokenFresh,
  isSessionValid,
  loadOdooBaseUrl,
  loadSession,
  saveOdooBaseUrl,
  saveSession,
  type PersistedSession,
} from '../../services/sessionStorage';
import { syncAttendanceFromServer } from '../../services/attendanceStorage';
import { waitUntilCameraReady } from '../../utils/cameraGate';
import { waitUntilGpsReady } from '../../utils/locationGate';
import { waitUntilOnline } from '../../utils/network';
import { askNotificationPermission } from '../../utils/notificationGate';
import { SafeAreaView } from 'react-native-safe-area-context';
import { registerPushForSession } from '../../services/pushNotificationService';
import { configureLocationTrackingInterval } from '../../services/locationTrackingService';

const SPLASH_DELAY_MS = 1500;

async function restoreOrRefreshSession(
  session: PersistedSession,
): Promise<PersistedSession | null> {
  if (isAccessTokenFresh(session)) {
    return session;
  }

  if (!canRefreshSession(session)) {
    return null;
  }

  try {
    const tokens = await refreshAccessToken(session.refreshToken);
    const updated: PersistedSession = {
      ...session,
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token,
      accessTokenExpiresAt: accessTokenExpiresAtFromExpiresIn(tokens.expires_in),
    };
    await saveSession(updated);
    return updated;
  } catch {
    return null;
  }
}

const SplashScreen = () => {
  const { isTablet } = useResponsive();
  const styles = createStyles(isTablet);
  const dispatch = useAppDispatch();

  useEffect(() => {
    let cancelled = false;
    let session: PersistedSession | null = null;
    let cancelWaitOnline: (() => void) | null = null;
    let cancelWaitGps: (() => void) | null = null;
    let cancelWaitCamera: (() => void) | null = null;

    const loadPromise = Promise.all([loadSession(), loadOdooBaseUrl()])
      .then(([loaded, savedBaseUrl]) => {
        session = loaded;
        const baseUrl =
          savedBaseUrl ||
          (loaded?.website ? loaded.website : null);
        if (baseUrl) {
          setOdooBaseUrl(baseUrl);
          if (!savedBaseUrl && loaded?.website) {
            // Migrate older installs that only stored website on the session.
            void saveOdooBaseUrl(loaded.website);
          }
        }
      })
      .catch(() => {
        session = null;
      });

    const timer = setTimeout(async () => {
      await loadPromise;
      if (cancelled) {
        return;
      }

      const onlineWait = waitUntilOnline();
      cancelWaitOnline = onlineWait.cancel;
      const online = await onlineWait.promise;
      cancelWaitOnline = null;
      if (cancelled || !online) {
        return;
      }

      const gpsWait = waitUntilGpsReady();
      cancelWaitGps = gpsWait.cancel;
      const gpsReady = await gpsWait.promise;
      cancelWaitGps = null;
      if (cancelled || !gpsReady) {
        return;
      }

      const cameraWait = waitUntilCameraReady();
      cancelWaitCamera = cameraWait.cancel;
      const cameraReady = await cameraWait.promise;
      cancelWaitCamera = null;
      if (cancelled || !cameraReady) {
        return;
      }

      // Soft ask — Allow or Don't allow both continue.
      console.log('[NotifPerm] splash calling ask');
      const notificationGranted = await askNotificationPermission();
      console.log('[NotifPerm] splash result', { granted: notificationGranted });
      if (cancelled) {
        return;
      }

      if (session && isSessionValid(session)) {
        const restored = await restoreOrRefreshSession(session);
        if (cancelled) {
          return;
        }
        if (restored) {
          configureLocationTrackingInterval(
            restored.locationTrackingIntervalSeconds,
          );
          dispatch(restoreSession(restored));
          await syncAttendanceFromServer(restored.accessToken);
          void registerPushForSession(restored.accessToken);
          if (cancelled) {
            return;
          }
          dispatch(setSessionHydrated(true));
          return;
        }
      }

      if (session) {
        await clearSession();
      }

      if (!cancelled) {
        dispatch(setSessionHydrated(true));
      }
    }, SPLASH_DELAY_MS);

    return () => {
      cancelled = true;
      cancelWaitOnline?.();
      cancelWaitGps?.();
      cancelWaitCamera?.();
      clearTimeout(timer);
    };
  }, [dispatch]);

  return (
    <SafeAreaView style={styles.container}>

    <View style={styles.container}>
      <Image
        source={require('../../assets/image/Splash_Screen_Images/ss_bg.png')}
        style={StyleSheet.absoluteFill}
        resizeMode="cover"
      />
      <StatusBar
        barStyle="light-content"
        translucent
        backgroundColor="transparent"
      />
      <View style={styles.content}>
        <Image
          source={require('../../assets/image/Splash_Screen_Images/Logo.png')}
          style={styles.logo}
          resizeMode="contain"
        />
        <Text style={styles.title}>
          {`Geo Employee\nTracker`}
        </Text>
      </View>
    </View>
    </SafeAreaView>

  );
};

export default SplashScreen;
