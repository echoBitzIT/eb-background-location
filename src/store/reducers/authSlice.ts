import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import type { MobileEmployee } from '../../services/apiClient';
import {
  DEFAULT_TRACKING_INTERVAL_SECONDS,
  normalizeLocationTrackingIntervalSeconds,
} from '../../services/locationTrackingService';
import type { PersistedSession } from '../../services/sessionStorage';
import {
  fetchProfileAction,
  loginAction,
  logoutAction,
  refreshSessionAction,
  searchCompanyAction,
  updateProfileAction,
} from '../actions/authActions';

type AuthState = {
  website: string;
  companyReference: string | null;
  companyName: string | null;
  companyLogo: string | false | null;
  termsAndConditions: string | null;
  locationTrackingIntervalSeconds: number;
  accessToken: string | null;
  refreshToken: string | null;
  accessTokenExpiresAt: string | null;
  employee: MobileEmployee | null;
  sessionHydrated: boolean;
  searchLoading: boolean;
  loginLoading: boolean;
  logoutLoading: boolean;
  profileLoading: boolean;
  profileSaving: boolean;
  searchError: string | null;
  loginError: string | null;
  profileError: string | null;
};

const initialState: AuthState = {
  website: '',
  companyReference: null,
  companyName: null,
  companyLogo: null,
  termsAndConditions: null,
  locationTrackingIntervalSeconds: DEFAULT_TRACKING_INTERVAL_SECONDS,
  accessToken: null,
  refreshToken: null,
  accessTokenExpiresAt: null,
  employee: null,
  sessionHydrated: false,
  searchLoading: false,
  loginLoading: false,
  logoutLoading: false,
  profileLoading: false,
  profileSaving: false,
  searchError: null,
  loginError: null,
  profileError: null,
};

/** Logged-out Redux state after splash has already run — do not remount Splash. */
function loggedOutState(): AuthState {
  return {
    ...initialState,
    sessionHydrated: true,
  };
}

const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    setWebsite(state, action: PayloadAction<string>) {
      state.website = action.payload;
    },
    clearSearchError(state) {
      state.searchError = null;
    },
    clearLoginError(state) {
      state.loginError = null;
    },
    clearProfileError(state) {
      state.profileError = null;
    },
    restoreSession(state, action: PayloadAction<PersistedSession>) {
      state.accessToken = action.payload.accessToken;
      state.refreshToken = action.payload.refreshToken;
      state.accessTokenExpiresAt = action.payload.accessTokenExpiresAt;
      state.employee = action.payload.employee;
      state.website = action.payload.website;
      state.companyName = action.payload.companyName;
      state.companyLogo = action.payload.companyLogo ?? null;
      state.companyReference =
        action.payload.employee.company_reference ?? state.companyReference;
      state.locationTrackingIntervalSeconds =
        normalizeLocationTrackingIntervalSeconds(
          action.payload.locationTrackingIntervalSeconds,
        );
    },
    /** Apply tokens from Axios 401 refresh without a full session restore. */
    setAuthTokens(
      state,
      action: PayloadAction<{
        accessToken: string;
        refreshToken: string;
        accessTokenExpiresAt: string;
      }>,
    ) {
      state.accessToken = action.payload.accessToken;
      state.refreshToken = action.payload.refreshToken;
      state.accessTokenExpiresAt = action.payload.accessTokenExpiresAt;
    },
    setLocationTrackingInterval(state, action: PayloadAction<number>) {
      state.locationTrackingIntervalSeconds =
        normalizeLocationTrackingIntervalSeconds(action.payload);
    },
    setSessionHydrated(state, action: PayloadAction<boolean>) {
      state.sessionHydrated = action.payload;
    },
    logout() {
      return loggedOutState();
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(searchCompanyAction.pending, (state) => {
        state.searchLoading = true;
        state.searchError = null;
      })
      .addCase(searchCompanyAction.fulfilled, (state, action) => {
        state.searchLoading = false;
        state.companyReference = action.payload.company_reference;
        state.companyName = action.payload.company_name;
        state.companyLogo = action.payload.logo;
        state.termsAndConditions = action.payload.terms_and_conditions || null;
      })
      .addCase(searchCompanyAction.rejected, (state, action) => {
        state.searchLoading = false;
        state.searchError = (action.payload as string) ?? 'search_failed';
      })
      .addCase(loginAction.pending, (state) => {
        state.loginLoading = true;
        state.loginError = null;
      })
      .addCase(loginAction.fulfilled, (state, action) => {
        state.loginLoading = false;
        state.accessToken = action.payload.access_token;
        state.refreshToken = action.payload.refresh_token;
        state.accessTokenExpiresAt = action.payload.accessTokenExpiresAt;
        state.employee = action.payload.employee;
      })
      .addCase(loginAction.rejected, (state, action) => {
        state.loginLoading = false;
        state.loginError = (action.payload as string) ?? 'login_failed';
      })
      .addCase(logoutAction.pending, (state) => {
        state.logoutLoading = true;
      })
      .addCase(logoutAction.fulfilled, () => loggedOutState())
      .addCase(logoutAction.rejected, () => loggedOutState())
      .addCase(refreshSessionAction.fulfilled, (state, action) => {
        state.accessToken = action.payload.accessToken;
        state.refreshToken = action.payload.refreshToken;
        state.accessTokenExpiresAt = action.payload.accessTokenExpiresAt;
      })
      .addCase(refreshSessionAction.rejected, () => loggedOutState())
      .addCase(fetchProfileAction.pending, (state) => {
        state.profileLoading = true;
        state.profileError = null;
      })
      .addCase(fetchProfileAction.fulfilled, (state, action) => {
        state.profileLoading = false;
        state.employee = action.payload;
      })
      .addCase(fetchProfileAction.rejected, (state, action) => {
        state.profileLoading = false;
        state.profileError = (action.payload as string) ?? 'profile_failed';
      })
      .addCase(updateProfileAction.pending, (state) => {
        state.profileSaving = true;
        state.profileError = null;
      })
      .addCase(updateProfileAction.fulfilled, (state, action) => {
        state.profileSaving = false;
        state.employee = action.payload;
      })
      .addCase(updateProfileAction.rejected, (state, action) => {
        state.profileSaving = false;
        state.profileError =
          (action.payload as string) ?? 'profile_update_failed';
      });
  },
});

export const {
  setWebsite,
  clearSearchError,
  clearLoginError,
  clearProfileError,
  restoreSession,
  setAuthTokens,
  setLocationTrackingInterval,
  setSessionHydrated,
  logout,
} = authSlice.actions;
export default authSlice.reducer;
