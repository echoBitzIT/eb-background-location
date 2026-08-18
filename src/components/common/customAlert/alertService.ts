export type ShowAlertOptions = {
  title: string;
  message?: string;
  confirmText?: string;
  cancelText?: string;
  onConfirm?: () => void;
  onCancel?: () => void;
  destructive?: boolean;
  cancelable?: boolean;
};

type AlertHandler = {
  show: (options: ShowAlertOptions) => void;
  hide: () => void;
};

let handler: AlertHandler | null = null;

export function registerAlertHandler(next: AlertHandler | null): void {
  handler = next;
}

export function showAlert(options: ShowAlertOptions): void {
  if (!handler) {
    return;
  }
  handler.show(options);
}

export function hideAlert(): void {
  handler?.hide();
}
