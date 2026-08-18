import Toast from 'react-native-toast-message';

export type ShowToastOptions = {
  message: string;
  durationMs?: number;
  type?: 'success' | 'info' | 'error';
};

const DEFAULT_DURATION_MS = 3500;

export function showToast({
  message,
  durationMs = DEFAULT_DURATION_MS,
  type = 'success',
}: ShowToastOptions): void {
  Toast.show({
    type,
    text1: message,
    position: 'bottom',
    visibilityTime: durationMs,
  });
}

export function hideToast(): void {
  Toast.hide();
}
