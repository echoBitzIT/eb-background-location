import { createAsyncThunk } from '@reduxjs/toolkit';
import { AUTH_ERRORS } from '../../constants/ApiEndpoints';
import {
  accessTokenExpiresAtFromExpiresIn,
  fetchMe,
  mobileLogin,
  refreshAccessToken,
  resetOdooBaseUrl,
  revokeToken,
  searchCompany,
  updateMe,
  type MeProfileUpdate,
  type MobileEmployee,
} from '../../services/apiClient';
import {
  clearSession,
  saveSession,
} from '../../services/sessionStorage';
import { syncAttendanceFromServer } from '../../services/attendanceStorage';
import {
  registerPushForSession,
  unregisterPushForSession,
} from '../../services/pushNotificationService';

type AuthRootState = {
  auth: {
    companyReference: string | null;
    companyName: string | null;
    companyLogo: string | false | null;
    website: string;
    accessToken: string | null;
    refreshToken: string | null;
    accessTokenExpiresAt: string | null;
    employee: MobileEmployee | null;
    locationTrackingIntervalSeconds: number;
  };
};

export const searchCompanyAction = createAsyncThunk(
  'auth/searchCompany',
  async (
    { website, mode }: { website: string; mode: 'light' | 'dark' },
    { rejectWithValue },
  ) => {
    try {
      return await searchCompany(website, mode);
    } catch (error: unknown) {
      const message =
        error instanceof Error ? error.message : AUTH_ERRORS.SEARCH_FAILED;
      return rejectWithValue(message);
    }
  },
);

export const loginAction = createAsyncThunk(
  'auth/login',
  async (
    { email, password }: { email: string; password: string },
    { getState, rejectWithValue },
  ) => {
    const { auth } = getState() as AuthRootState;

    if (!auth.companyReference) {
      return rejectWithValue(AUTH_ERRORS.INVALID_SESSION);
    }

    try {
      const result = await mobileLogin({
        company_reference: auth.companyReference,
        email,
        password,
      });

      const accessTokenExpiresAt = accessTokenExpiresAtFromExpiresIn(
        result.expires_in,
      );

      await saveSession({
        accessToken: result.access_token,
        refreshToken: result.refresh_token,
        accessTokenExpiresAt,
        employee: result.employee,
        website: auth.website,
        companyName: auth.companyName ?? result.employee.company_name,
        companyLogo: auth.companyLogo,
        locationTrackingIntervalSeconds: auth.locationTrackingIntervalSeconds,
      });

      await syncAttendanceFromServer(result.access_token);
      void registerPushForSession(result.access_token);

      return {
        ...result,
        accessTokenExpiresAt,
      };
    } catch (error: unknown) {
      const message =
        error instanceof Error ? error.message : AUTH_ERRORS.LOGIN_FAILED;
      return rejectWithValue(message);
    }
  },
);

/** Revoke access + refresh tokens on server when possible; always clears local session. */
export const logoutAction = createAsyncThunk(
  'auth/logout',
  async (_arg, { getState }) => {
    const { auth } = getState() as AuthRootState;
    const { accessToken, refreshToken } = auth;

    await unregisterPushForSession(accessToken);

    // Best-effort: revoke both so splash cannot mint a new access token.
    await Promise.allSettled([
      accessToken ? revokeToken(accessToken) : Promise.resolve(),
      refreshToken ? revokeToken(refreshToken) : Promise.resolve(),
    ]);

    await clearSession();
    resetOdooBaseUrl();
  },
);

/** Refresh OAuth tokens and persist; used by splash on expired access token. */
export const refreshSessionAction = createAsyncThunk(
  'auth/refreshSession',
  async (_arg, { getState, rejectWithValue }) => {
    const { auth } = getState() as AuthRootState;
    if (!auth.refreshToken || !auth.employee) {
      return rejectWithValue(AUTH_ERRORS.UNAUTHORIZED);
    }

    try {
      const tokens = await refreshAccessToken(auth.refreshToken);
      const accessTokenExpiresAt = accessTokenExpiresAtFromExpiresIn(
        tokens.expires_in,
      );

      await saveSession({
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token,
        accessTokenExpiresAt,
        employee: auth.employee,
        website: auth.website,
        companyName: auth.companyName,
        companyLogo: auth.companyLogo,
        locationTrackingIntervalSeconds: auth.locationTrackingIntervalSeconds,
      });

      return {
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token,
        accessTokenExpiresAt,
      };
    } catch (error: unknown) {
      await clearSession();
      resetOdooBaseUrl();
      const message =
        error instanceof Error ? error.message : AUTH_ERRORS.UNAUTHORIZED;
      return rejectWithValue(message);
    }
  },
);

/** Load current employee profile via GET /api/v1/me. */
export const fetchProfileAction = createAsyncThunk(
  'auth/fetchProfile',
  async (_arg, { getState, rejectWithValue }) => {
    const { auth } = getState() as AuthRootState;

    if (!auth.accessToken || !auth.refreshToken) {
      return rejectWithValue(AUTH_ERRORS.UNAUTHORIZED);
    }

    try {
      const employee = await fetchMe(auth.accessToken);
      await saveSession({
        accessToken: auth.accessToken,
        refreshToken: auth.refreshToken,
        accessTokenExpiresAt: auth.accessTokenExpiresAt,
        employee,
        website: auth.website,
        companyName: auth.companyName ?? employee.company_name,
        companyLogo: auth.companyLogo,
        locationTrackingIntervalSeconds: auth.locationTrackingIntervalSeconds,
      });
      return employee;
    } catch (error: unknown) {
      const message =
        error instanceof Error ? error.message : AUTH_ERRORS.PROFILE_FAILED;
      return rejectWithValue(message);
    }
  },
);

/** Update name / work_phone / avatar via PATCH /api/v1/me and persist session. */
export const updateProfileAction = createAsyncThunk(
  'auth/updateProfile',
  async (body: MeProfileUpdate, { getState, rejectWithValue }) => {
    const { auth } = getState() as AuthRootState;
    if (!auth.accessToken || !auth.refreshToken) {
      return rejectWithValue(AUTH_ERRORS.UNAUTHORIZED);
    }

    const payload: MeProfileUpdate = {};
    if (body.name !== undefined) {
      payload.name = body.name;
    }
    if (body.work_phone !== undefined) {
      payload.work_phone = body.work_phone;
    }
    if (body.avatar !== undefined) {
      payload.avatar = body.avatar;
    }
    if (Object.keys(payload).length === 0) {
      return rejectWithValue(AUTH_ERRORS.INVALID_REQUEST);
    }

    try {
      const employee = await updateMe(auth.accessToken, payload);
      await saveSession({
        accessToken: auth.accessToken,
        refreshToken: auth.refreshToken,
        accessTokenExpiresAt: auth.accessTokenExpiresAt,
        employee,
        website: auth.website,
        companyName: auth.companyName ?? employee.company_name,
        companyLogo: auth.companyLogo,
        locationTrackingIntervalSeconds: auth.locationTrackingIntervalSeconds,
      });
      return employee;
    } catch (error: unknown) {
      const message =
        error instanceof Error
          ? error.message
          : AUTH_ERRORS.PROFILE_UPDATE_FAILED;
      return rejectWithValue(message);
    }
  },
);
