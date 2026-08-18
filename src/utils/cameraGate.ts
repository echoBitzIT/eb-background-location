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

function cameraPermission(): Permission {
  return Platform.OS === 'ios'
    ? PERMISSIONS.IOS.CAMERA
    : PERMISSIONS.ANDROID.CAMERA;
}

function isPermissionGranted(status: PermissionStatus): boolean {
  return status === RESULTS.GRANTED || status === RESULTS.LIMITED;
}

/**
 * System camera permission dialog.
 * BLOCKED means the user permanently denied — cannot re-prompt; caller falls back.
 */
export async function isCameraReady(): Promise<boolean> {
  const permission = cameraPermission();
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

export type WaitUntilCameraReadyHandle = {
  promise: Promise<boolean>;
  cancel: () => void;
};

/**
 * Runs the native camera permission dialog first.
 * Only if that fails (blocked / denied) shows a custom Camera Required alert
 * with Retry / Open Settings.
 */
export function waitUntilCameraReady(): WaitUntilCameraReadyHandle {
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

    const ready = await isCameraReady();
    if (settled) {
      return;
    }

    if (ready) {
      finish(true);
      return;
    }

    if (alertVisible) {
      return;
    }

    alertVisible = true;
    showAlert({
      title: 'Camera Required',
      message: 'Please allow camera access to use this app.',
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
