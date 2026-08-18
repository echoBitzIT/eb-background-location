/**
 * Auth session bridge — lets Axios interceptors refresh tokens without
 * importing the Redux store (avoids circular deps with apiClient).
 */

export type RefreshedTokens = {
  accessToken: string;
  refreshToken: string;
  accessTokenExpiresAt: string;
};

export type AuthSessionBridge = {
  getAccessToken: () => string | null;
  getRefreshToken: () => string | null;
  applyRefreshedTokens: (tokens: RefreshedTokens) => Promise<void>;
  onAuthFailure: () => Promise<void>;
};

let bridge: AuthSessionBridge | null = null;

export function registerAuthSessionBridge(next: AuthSessionBridge): void {
  bridge = next;
}

export function getAuthSessionBridge(): AuthSessionBridge | null {
  return bridge;
}
