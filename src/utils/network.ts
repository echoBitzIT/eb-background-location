import NetInfo, { type NetInfoState } from '@react-native-community/netinfo';
import { showAlert } from '../components/common/customAlert/alertService';

export function isOnline(state: NetInfoState): boolean {
  return state.isConnected === true && state.isInternetReachable !== false;
}

export type WaitUntilOnlineHandle = {
  promise: Promise<boolean>;
  cancel: () => void;
};

/**
 * Resolves when the device is online. If offline, shows a non-cancelable alert
 * with Retry and also waits on NetInfo reconnect so the flow can continue
 * without another tap when the network returns.
 */
export function waitUntilOnline(): WaitUntilOnlineHandle {
  let settled = false;
  let unsubscribe: (() => void) | null = null;
  let alertVisible = false;
  let resolvePromise: (online: boolean) => void = () => {};

  const finish = (online: boolean) => {
    if (settled) {
      return;
    }
    settled = true;
    unsubscribe?.();
    unsubscribe = null;
    resolvePromise(online);
  };

  const checkAndMaybeAlert = async () => {
    if (settled) {
      return;
    }

    const state = await NetInfo.fetch();
    if (settled) {
      return;
    }

    if (isOnline(state)) {
      finish(true);
      return;
    }

    if (alertVisible) {
      return;
    }

    alertVisible = true;
    showAlert({
      title: 'No Internet',
      message: 'Please check your network connection and try again.',
      confirmText: 'Retry',
      cancelable: false,
      onConfirm: () => {
        alertVisible = false;
        void checkAndMaybeAlert();
      },
    });
  };

  const promise = new Promise<boolean>(resolve => {
    resolvePromise = resolve;

    unsubscribe = NetInfo.addEventListener(state => {
      if (settled) {
        return;
      }
      if (isOnline(state)) {
        finish(true);
      }
    });

    void checkAndMaybeAlert();
  });

  return {
    promise,
    cancel: () => finish(false),
  };
}
