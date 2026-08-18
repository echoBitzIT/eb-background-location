import React, { useCallback, useEffect, useMemo, useState } from 'react';
import CustomAlert from './CustomAlert';
import {
  registerAlertHandler,
  type ShowAlertOptions,
} from './alertService';

type AlertState = ShowAlertOptions & {
  visible: boolean;
};

const INITIAL_STATE: AlertState = {
  visible: false,
  title: '',
};

export function AlertProvider({ children }: { children: React.ReactNode }) {
  const [alert, setAlert] = useState<AlertState>(INITIAL_STATE);

  const hide = useCallback(() => {
    setAlert(INITIAL_STATE);
  }, []);

  const show = useCallback((options: ShowAlertOptions) => {
    setAlert({
      ...options,
      visible: true,
      confirmText: options.confirmText ?? 'OK',
    });
  }, []);

  useEffect(() => {
    registerAlertHandler({ show, hide });
    return () => registerAlertHandler(null);
  }, [show, hide]);

  const handleConfirm = useCallback(() => {
    const { onConfirm } = alert;
    hide();
    onConfirm?.();
  }, [alert, hide]);

  const handleCancel = useCallback(() => {
    const { onCancel } = alert;
    hide();
    onCancel?.();
  }, [alert, hide]);

  const cancelable = useMemo(() => {
    if (typeof alert.cancelable === 'boolean') {
      return alert.cancelable;
    }
    return Boolean(alert.cancelText);
  }, [alert.cancelable, alert.cancelText]);

  return (
    <>
      {children}
      <CustomAlert
        visible={alert.visible}
        title={alert.title}
        message={alert.message}
        confirmText={alert.confirmText}
        cancelText={alert.cancelText}
        destructive={alert.destructive}
        cancelable={cancelable}
        onConfirm={handleConfirm}
        onCancel={handleCancel}
      />
    </>
  );
}
