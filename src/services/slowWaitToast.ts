import { API_ENDPOINTS } from '../constants/ApiEndpoints';
import { showToast } from '../components/common/customToast/toastService';

/** Neutral copy (Option A). Do not say "slow internet". */
export const SLOW_WAIT_MESSAGE = 'Still working. Please wait…';

const SLOW_WAIT_MS = 3500;
const TOAST_DURATION_MS = 4000;

/** Background / silent APIs — never show the wait toast. */
const SKIP_PATH_FRAGMENTS = [
  API_ENDPOINTS.FIELD_LOCATION,
  API_ENDPOINTS.AUTH_REFRESH,
  API_ENDPOINTS.FIELD_DEVICE_TOKEN,
];

let inFlight = 0;
let waitTimer: ReturnType<typeof setTimeout> | null = null;
let toastShownForThisWait = false;
let suppressUntil = 0;

function shouldTrackUrl(url?: string, method?: string): boolean {
  const m = (method ?? 'get').toLowerCase();
  if (m === 'get') {
    return false;
  }
  if (!url) {
    return true;
  }
  return !SKIP_PATH_FRAGMENTS.some(path => url.includes(path));
}

function clearWaitTimer(): void {
  if (waitTimer != null) {
    clearTimeout(waitTimer);
    waitTimer = null;
  }
}

export function suppressSlowWaitToast(ms = 4000): void {
  suppressUntil = Date.now() + ms;
  clearWaitTimer();
}

export function onTrackedRequestStart(url?: string, method?: string): void {
  if (!shouldTrackUrl(url, method)) {
    return;
  }

  inFlight += 1;
  if (inFlight !== 1 || toastShownForThisWait) {
    return;
  }

  waitTimer = setTimeout(() => {
    waitTimer = null;
    if (inFlight <= 0 || Date.now() < suppressUntil) {
      return;
    }
    toastShownForThisWait = true;
    showToast({
      message: SLOW_WAIT_MESSAGE,
      type: 'info',
      durationMs: TOAST_DURATION_MS,
    });
  }, SLOW_WAIT_MS);
}

/**
 * Pair with every start. Do not Toast.hide() here —
 * a success toast (Check-in successful) may have just replaced it.
 */
export function onTrackedRequestEnd(url?: string, method?: string): void {
  if (!shouldTrackUrl(url, method)) {
    return;
  }

  inFlight = Math.max(0, inFlight - 1);
  if (inFlight > 0) {
    return;
  }

  clearWaitTimer();
  toastShownForThisWait = false;
}
