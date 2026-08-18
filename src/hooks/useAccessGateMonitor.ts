import { useEffect, useRef } from 'react';
import { AppState, Linking, type AppStateStatus } from 'react-native';
import { showAlert } from '../components/common/customAlert/alertService';
import { isCameraReady } from '../utils/cameraGate';
import { isLocationReady } from '../utils/locationGate';

type Options = {
  enabled: boolean;
};

/**
 * Continuous GPS + camera gate for post-splash screens.
 * Re-checks on mount and whenever the app returns to the foreground.
 * Shows one blocking alert at a time until access is restored.
 */
export function useAccessGateMonitor({ enabled }: Options): void {
  const enabledRef = useRef(enabled);
  const alertVisibleRef = useRef(false);
  const leftForSettingsRef = useRef(false);
  const checkingRef = useRef(false);

  enabledRef.current = enabled;

  useEffect(() => {
    let cancelled = false;

    const showAccessAlert = (
      title: string,
      message: string,
      onRetry: () => void,
    ) => {
      if (alertVisibleRef.current || cancelled || !enabledRef.current) {
        return;
      }

      alertVisibleRef.current = true;
      showAlert({
        title,
        message,
        confirmText: 'Open Settings',
        cancelText: 'Retry',
        cancelable: false,
        onConfirm: () => {
          leftForSettingsRef.current = true;
          alertVisibleRef.current = false;
          void Linking.openSettings();
        },
        onCancel: () => {
          alertVisibleRef.current = false;
          onRetry();
        },
      });
    };

    const enforce = async () => {
      if (
        cancelled ||
        !enabledRef.current ||
        alertVisibleRef.current ||
        checkingRef.current
      ) {
        return;
      }

      checkingRef.current = true;
      try {
        const gpsReady = await isLocationReady();
        if (cancelled || !enabledRef.current) {
          return;
        }
        if (!gpsReady) {
          showAccessAlert(
            'Location Required',
            'Please enable GPS and allow location access to use this app.',
            () => {
              void enforce();
            },
          );
          return;
        }

        const cameraReady = await isCameraReady();
        if (cancelled || !enabledRef.current) {
          return;
        }
        if (!cameraReady) {
          showAccessAlert(
            'Camera Required',
            'Please allow camera access to use this app.',
            () => {
              void enforce();
            },
          );
        }
      } finally {
        checkingRef.current = false;
      }
    };

    const onAppStateChange = (nextState: AppStateStatus) => {
      if (cancelled || nextState !== 'active' || !enabledRef.current) {
        return;
      }

      // Ignore AppState flicker from Alert itself unless user opened Settings.
      if (alertVisibleRef.current && !leftForSettingsRef.current) {
        return;
      }

      if (leftForSettingsRef.current) {
        leftForSettingsRef.current = false;
        alertVisibleRef.current = false;
      }

      void enforce();
    };

    if (enabled) {
      void enforce();
    }

    const subscription = AppState.addEventListener('change', onAppStateChange);

    return () => {
      cancelled = true;
      subscription.remove();
    };
  }, [enabled]);
}
