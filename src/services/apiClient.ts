import axios from 'axios';
import type { AxiosError, InternalAxiosRequestConfig } from 'axios';
import { API_ENDPOINTS, AUTH_ERRORS, fieldSessionPath, fieldSessionRoutePath, fieldStopImagesPath, fieldStopPath, fieldStopSelfiePath, fieldTaskArrivePath, fieldTaskCancelPath, fieldTaskCompletePath, fieldTaskPath, fieldTaskPausePath, fieldTaskStartPath, hrLeaveAttachmentsPath } from '../constants/ApiEndpoints';
import type { AttendanceDayStatus } from '../constants/AttendanceStatus';
import { getAuthSessionBridge } from './authSessionBridge';
import {
  onTrackedRequestEnd,
  onTrackedRequestStart,
} from './slowWaitToast';

const api = axios.create({
  baseURL: '', 
  timeout: 15000,
  headers: { 'Content-Type': 'application/json' },
 });
              
type RequestMeta = {
  start: number;
};

type RetryableConfig = InternalAxiosRequestConfig & {
  _retry?: boolean;
  metadata?: RequestMeta;
};

/** True when Axios/AbortController canceled the request. */
export function isRequestCanceled(error: unknown): boolean {
  if (axios.isCancel(error)) {
    return true;
  }
  if (!error || typeof error !== 'object') {
    return false;
  }
  const err = error as { code?: string; name?: string; message?: string };
  return (
    err.code === 'ERR_CANCELED' ||
    err.name === 'CanceledError' ||
    err.name === 'AbortError' ||
    err.message === 'canceled'
  );
}

export type RequestOptions = {
  signal?: AbortSignal;
};

const AUTH_SKIP_REFRESH_PATHS = new Set<string>([
  API_ENDPOINTS.COMPANY_SEARCH,
  API_ENDPOINTS.MOBILE_LOGIN,
  API_ENDPOINTS.AUTH_REFRESH,
  API_ENDPOINTS.AUTH_REVOKE,
]);

let refreshInFlight: Promise<string> | null = null;

async function refreshAccessTokenSingleFlight(): Promise<string> {
  if (refreshInFlight) {
    return refreshInFlight;
  }

  refreshInFlight = (async () => {
    const bridge = getAuthSessionBridge();
    const refreshToken = bridge?.getRefreshToken() ?? null;
    if (!bridge || !refreshToken) {
      throw new Error(AUTH_ERRORS.UNAUTHORIZED);
    }

    const tokens = await refreshAccessToken(refreshToken);
    const accessTokenExpiresAt = accessTokenExpiresAtFromExpiresIn(
      tokens.expires_in,
    );
    await bridge.applyRefreshedTokens({
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token,
      accessTokenExpiresAt,
    });
    return tokens.access_token;
  })().finally(() => {
    refreshInFlight = null;
  });

  return refreshInFlight;
}

function installApiInterceptors(): void {
  api.interceptors.request.use((config: RetryableConfig) => {
    onTrackedRequestStart(config.url, config.method);

    if (__DEV__) {
      config.metadata = { start: Date.now() };
      const method = (config.method ?? 'get').toUpperCase();
      const url = `${config.baseURL ?? ''}${config.url ?? ''}`;
      console.log('[API→]', method, url);
    }
    return config;
  });

  api.interceptors.response.use(
    (response) => {
      onTrackedRequestEnd(response.config.url, response.config.method);

      if (__DEV__) {
        const cfg = response.config as RetryableConfig;
        const start = cfg.metadata?.start ?? Date.now();
        const size = JSON.stringify(response.data ?? '').length;
        console.log(
          '[API←]',
          response.status,
          cfg.url,
          `${Date.now() - start}ms`,
          `${size}B`,
        );
      }
      return response;
    },
    async (error: AxiosError) => {
      const config = error.config as RetryableConfig | undefined;

      onTrackedRequestEnd(config?.url, config?.method);

      if (__DEV__ && config) {
        const start = config.metadata?.start ?? Date.now();
        console.log(
          '[API×]',
          config.url,
          `${Date.now() - start}ms`,
          error.response?.status ?? error.message,
        );
      }

      if (!config || error.response?.status !== 401 || config._retry) {
        return Promise.reject(error);
      }

      const path = config.url ?? '';
      if (AUTH_SKIP_REFRESH_PATHS.has(path)) {
        return Promise.reject(error);
      }

      try {
        config._retry = true;
        const accessToken = await refreshAccessTokenSingleFlight();
        config.headers = config.headers ?? {};
        config.headers.Authorization = `Bearer ${accessToken}`;
        return api.request(config);
      } catch (refreshError) {
        const bridge = getAuthSessionBridge();
        if (bridge) {
          await bridge.onAuthFailure();
        }
        return Promise.reject(refreshError);
      }
    },
  );
}

installApiInterceptors();

/** Trim and strip trailing slashes. Callers must pass an already-valid HTTPS URL. */
export function normalizeOdooBaseUrl(url: string): string {
  return url.trim().replace(/\/+$/, '');
}

export function setOdooBaseUrl(url: string): void {
  api.defaults.baseURL = normalizeOdooBaseUrl(url);
}

export function getOdooBaseUrl(): string {
  return api.defaults.baseURL ?? '';
}

/** Clear Axios base URL (e.g. after logout). Host comes only from Fetch URL. */
export function resetOdooBaseUrl(): void {
  api.defaults.baseURL = '';
}

export type CompanySearchResult = {
  company_reference: string;
  company_name: string;
  logo: string | false;
  terms_and_conditions?: string | false;
};

export type MobileEmployee = {
  id?: number;
  name: string;
  job_title: string | false;
  work_email: string | false;
  work_phone: string | false;
  mobile_phone: string | false;
  department: string | false;
  manager: string | false;
  avatar: string | false;
  is_field_employee: boolean;
  company_name: string;
  company_reference: string;
};

export type MobileLoginResult = {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  employee: MobileEmployee;
};

export type TokenRefreshResult = {
  access_token: string;
  refresh_token: string;
  expires_in: number;
};

export type MeProfileUpdate = {
  name?: string;
  work_phone?: string;
  avatar?: string;
};

export type FieldCheckInPayload = {
  attendance_mode?: string;
  checkin_image: string;
};

export type FieldCheckInResult = {
  attendance_id: number;
  employee_id: number;
  check_in: string;
  attendance_mode: string;
};

export type FieldCheckOutPayload = {
  checkout_image: string;
};

export type FieldCheckOutResult = {
  attendance_id: number;
  employee_id: number;
  check_in: string;
  check_out: string;
  attendance_mode: string;
  session_id: number | false;
  session_state: string | false;
};

export type FieldSessionStatus = {
  attendance_id: number;
  employee_id: number;
  check_in: string;
  check_out: string | false;
  attendance_mode: string;
  session_id: number | false;
  session_state: string | false;
  active_task_id: number | false;
  active_task_state: string | false;
  active_task_stop_id: number | false;
};

export type FieldSessionFetchResult = {
  status: FieldSessionStatus | null;
  locationTrackingIntervalSeconds?: number;
};

export type FieldStartSessionPayload = {
  point_uuid: string;
  latitude: number;
  longitude: number;
  accuracy?: number;
};

export type FieldStartSessionResult = {
  session_id: number;
  attendance_id: number;
  employee_id: number;
  state: string;
  checkin_datetime: string | false;
  checkout_datetime: string | false;
  field_tracking_status: string | false;
};

/** Optional GPS point for end-session; backend records a final point only when latitude is set. */
export type FieldEndSessionPayload = {
  point_uuid?: string;
  latitude?: number;
  longitude?: number;
  accuracy?: number;
};

export type FieldEndSessionResult = FieldStartSessionResult;

export type FieldAddStopPayload = {
  stop_uuid: string;
  point_uuid: string;
  latitude: number;
  longitude: number;
  accuracy?: number;
  note?: string;
  selfie?: string;
  stop_type?: string;
};

export type FieldAddStopResult = {
  stop_id: number;
  session_id: number;
  stop_uuid: string | false;
  stop_type: string;
  visit_note: string | false;
  has_selfie: boolean;
  latitude: number;
  longitude: number;
  stop_datetime: string | false;
};

export type FieldLocationPoint = {
  point_uuid: string;
  latitude: number;
  longitude: number;
  accuracy?: number;
  device_timestamp?: string;
  altitude?: number;
  speed?: number;
  heading?: number;
  battery_level?: number;
  sequence_number?: number;
  is_offline_sync?: boolean;
};

export type FieldLocationUploadPayload = {
  points: FieldLocationPoint[];
};

export type FieldLocationUploadResult = {
  accepted: number;
  duplicate: number;
  rejected: number;
  session_state: string;
  session_health: string;
};

export type AttendanceCalendarPunch = {
  attendance_id: number;
  check_in: string | false;
  check_out: string | false;
  check_in_local: string | false;
  check_out_local: string | false;
  worked_hours: number;
  attendance_mode: string | false;
  review_state: string | false;
  is_open: boolean;
  session_id: number | false;
  session_state: string | false;
};

export type AttendanceCalendarDay = {
  date: string;
  status: AttendanceDayStatus;
  label: string | false;
  is_working_day: boolean;
  attendances: AttendanceCalendarPunch[];
  check_in: string | false;
  check_out: string | false;
  check_in_local: string | false;
  check_out_local: string | false;
  worked_hours: number;
  attendance_mode: string | false;
  session_id: number | false;
  session_state: string | false;
  review_state: string | false;
  is_open: boolean;
};

export type AttendanceCalendarSummary = {
  present: number;
  absent: number;
  leave: number;
  half_day: number;
  holiday: number;
  weekly_off: number;
  worked_hours: number;
};

export type AttendanceCalendarResult = {
  employee_id: number;
  date_from: string;
  date_to: string;
  timezone: string;
  summary: AttendanceCalendarSummary;
  days: AttendanceCalendarDay[];
};

export type FieldHistoryDay = {
  date: string;
  session_count: number;
  tracking_hours: number;
  total_distance_km: number;
  stop_count: number;
  tasks_completed: number;
  tasks_cancelled: number;
  session_ids: number[];
};

export type FieldHistoryResult = {
  employee_id: number;
  date_from: string;
  date_to: string;
  timezone: string;
  days: FieldHistoryDay[];
};

export type FieldHistoryYearsResult = {
  employee_id: number;
  timezone: string;
  years: number[];
};

export type FieldHistorySession = {
  session_id: number;
  name: string;
  state: string;
  health: string;
  checkin_datetime: string | false;
  checkout_datetime: string | false;
  tracking_duration_hours: number;
  total_distance_km: number;
  valid_points: number;
  stop_count: number;
  task_count: number;
  has_route: boolean;
};

export type FieldHistorySessionsResult = {
  employee_id: number;
  total: number;
  limit: number;
  offset: number;
  sessions: FieldHistorySession[];
};

export type FetchFieldHistorySessionsParams = {
  from?: string;
  to?: string;
  limit?: number;
  offset?: number;
};

/** [latitude, longitude, timestamp, task_id] — task_id false = default route. */
export type FieldHistoryTrailPoint = [
  number,
  number,
  string,
  number | false,
];

export type FieldSessionRouteTrailSource = 'points' | 'polyline' | 'purged';

export type FieldSessionRouteStop = {
  stop_id: number;
  task_id: number | false;
  latitude: number;
  longitude: number;
  name: string | false;
  stop_datetime: string | false;
};

export type FieldSessionRouteTask = {
  task_id: number;
  name: string;
  state: string;
};

export type FieldSessionRouteResult = {
  session_id: number;
  trail_source: FieldSessionRouteTrailSource;
  trail: FieldHistoryTrailPoint[] | string | false;
  stops: FieldSessionRouteStop[];
  tasks: FieldSessionRouteTask[];
};

export type FetchFieldSessionRouteParams = {
  max_points?: number;
};

export type HrLeaveMany2One = {
  id: number;
  display_name: string;
};

export type HrLeaveRecord = {
  id: number;
  holiday_status_id: HrLeaveMany2One | null;
  request_date_from: string;
  request_date_to: string;
  number_of_days: number;
  state: string;
  can_cancel: boolean;
  supported_attachment_ids_count: number;
  name: string | false;
};

export type FetchHrLeavesParams = {
  limit?: number;
  offset?: number;
};

export type HrLeaveType = {
  id: number;
  name: string;
  request_unit: 'day' | 'half_day' | 'hour' | string;
  unpaid: boolean;
  requires_allocation: boolean;
  has_valid_allocation: boolean;
  support_document: boolean;
  virtual_remaining_leaves: number;
  max_leaves: number;
  leaves_taken: number;
};

export type CreateHrLeaveBody = {
  holiday_status_id: number;
  employee_id: number;
  request_date_from: string;
  request_date_to: string;
  name: string;
  request_date_from_period?: 'am' | 'pm';
  request_date_to_period?: 'am' | 'pm';
};

export type HrLeaveAttachmentFile = {
  uri: string;
  name: string;
  type?: string;
};

export type FieldTaskStatus =
  | 'all'
  | 'pending'
  | 'active'
  | 'paused'
  | 'completed'
  | 'cancelled'
  | 'draft';

export type FieldTask = {
  task_id: number;
  reference: string | false;
  name: string;
  state: string;
  status: Exclude<FieldTaskStatus, 'all'>;
  priority: string | false;
  partner_id: number | false;
  partner_name: string | false;
  address: string | false;
  latitude: number;
  longitude: number;
  distance_km: number | false;
  arrival_radius_m: number;
  deadline: string | false;
  start_task_date: string | false;
  is_overdue: boolean;
  is_upcoming: boolean;
  task_type_id: number | false;
  task_type_name: string | false;
  session_id: number | false;
  stop_id: number | false;
  started_at: string | false;
  arrived_at: string | false;
  completed_at: string | false;
  paused_at?: string | false;
  duration_minutes?: number;
  paused_minutes?: number;
  pause_reason?: string | false;
  pause_note?: string | false;
  checklist_done_count: number;
  checklist_total_count: number;
};

export type FieldTaskCounts = {
  all: number;
  pending: number;
  active: number;
  paused: number;
  completed: number;
  cancelled: number;
  overdue: number;
};

export type FieldTaskListResult = {
  employee_id: number;
  status: FieldTaskStatus;
  total: number;
  limit: number;
  offset: number;
  counts: FieldTaskCounts;
  checked_in: boolean;
  attendance_id: number | false;
  session_id: number | false;
  session_state: string | false;
  active_task_id: number | false;
  tasks: FieldTask[];
};

export type FetchFieldTasksParams = {
  status?: Exclude<FieldTaskStatus, 'draft'>;
  latitude?: number;
  longitude?: number;
  from?: string;
  to?: string;
  date_field?: 'calendar';
  limit?: number;
  offset?: number;
};

export type FieldTaskChecklistLine = {
  id: number;
  name: string;
  section: 'todo' | 'before_submit' | string;
  is_required: boolean;
  is_done: boolean;
};

export type FieldTaskRequirements = {
  note_required: boolean;
  selfie_required: boolean;
  max_images: number;
};

export type FieldTaskCancelReason = {
  value: string;
  label: string;
};

export type FieldTaskPauseReason = {
  value: string;
  label: string;
};

export type FieldTaskLastVisit = {
  stop_id: number;
  stop_datetime: string | false;
  employee_name: string;
  visit_note: string | false;
};

export type FieldTaskOpenStop = {
  stop_id: number;
  session_id: number;
  task_id: number | false;
  is_open: boolean;
  stop_uuid: string | false;
  stop_type: string;
  partner_id: number | false;
  partner_name: string | false;
  employee_id?: number | false;
  employee_name?: string | false;
  stop_datetime?: string | false;
  departure_datetime?: string | false;
  duration_minutes?: number;
  paused_minutes?: number;
  latitude: number;
  longitude: number;
  accuracy?: number | false;
  address?: string | false;
  visit_note: string | false;
  has_selfie: boolean;
  image_count: number;
  selfie_attachment_id?: number | false;
  images?: { id: number; name: string }[];
};

export type FieldTaskDetail = FieldTask & {
  description?: string | false;
  requirements?: FieldTaskRequirements;
  cancel_reasons?: FieldTaskCancelReason[];
  pause_reasons?: FieldTaskPauseReason[];
  pause_reason?: string | false;
  pause_note?: string | false;
  last_visit?: FieldTaskLastVisit | false;
  open_stop?: FieldTaskOpenStop | false;
  checklist: {
    todo: FieldTaskChecklistLine[];
    before_submit: FieldTaskChecklistLine[];
  };
};

export type FieldSessionDetailStop = {
  stop_id: number;
  session_id: number;
  task_id: number | false;
  is_open: boolean;
  stop_uuid: string | false;
  stop_type: string;
  partner_id: number | false;
  partner_name: string | false;
  employee_id?: number;
  employee_name?: string;
  stop_datetime: string | false;
  departure_datetime?: string | false;
  duration_minutes?: number;
  paused_minutes?: number;
  latitude: number;
  longitude: number;
  accuracy?: number | false;
  address: string | false;
  visit_note: string | false;
  has_selfie: boolean;
  image_count: number;
  selfie_attachment_id?: number | false;
  images?: { id: number; name: string | false }[];
};

export type FieldSessionDetail = FieldHistorySession & {
  stops: FieldSessionDetailStop[];
  tasks: FieldTask[];
};

export type FieldStopImage = {
  id: number;
  name: string | false;
  image?: string | false;
};

export type FieldStopDetail = {
  stop_id: number;
  session_id: number;
  task_id: number | false;
  is_open: boolean;
  stop_uuid: string | false;
  stop_type: string;
  partner_id: number | false;
  partner_name: string | false;
  employee_id?: number;
  employee_name?: string;
  stop_datetime: string | false;
  departure_datetime?: string | false;
  duration_minutes?: number;
  paused_minutes?: number;
  latitude: number;
  longitude: number;
  accuracy?: number | false;
  address: string | false;
  visit_note: string | false;
  has_selfie: boolean;
  image_count: number;
  selfie?: string | false;
  selfie_attachment_id?: number | false;
  images: FieldStopImage[];
};

export type FetchFieldStopDetailParams = {
  include_images?: boolean;
};

export type FieldStopPayload = {
  stop_id: number;
  session_id: number;
  task_id: number | false;
  is_open: boolean;
  stop_uuid: string | false;
  stop_type: string;
  partner_id: number | false;
  partner_name: string | false;
  visit_note: string | false;
  has_selfie: boolean;
  image_count: number;
  latitude: number;
  longitude: number;
  paused_minutes?: number;
};

export type ArriveFieldTaskResult = {
  task: FieldTaskDetail;
  stop: FieldStopPayload;
};

export type CompleteFieldTaskResult = {
  task: FieldTaskDetail;
  stop: FieldStopPayload | false;
};

export type FieldLatLng = {
  latitude: number;
  longitude: number;
};

export type FieldMapConfig = {
  maps_configured: boolean;
  /** Company Google Maps JS key from Odoo; null when not configured. */
  google_maps_api_key: string | null;
};

export type FieldTravelMode = 'driving' | 'walking' | 'bicycling' | 'transit';
export type FieldAvoidOption = 'tolls' | 'highways' | 'ferries';

export type FieldRouteStep = {
  instruction: string;
  distance_meters: number;
  duration_seconds: number;
};

export type FieldAltRoute = {
  summary: string;
  coordinates: FieldLatLng[];
  distance_meters: number;
  duration_seconds: number;
  steps?: FieldRouteStep[];
};

export type FieldDirectionsResult = {
  coordinates: FieldLatLng[];
  distance_meters: number;
  duration_seconds: number;
  maps_configured: boolean;
  steps?: FieldRouteStep[];
  routes?: FieldAltRoute[];
};

export type FetchFieldDirectionsParams = {
  originLatitude: number;
  originLongitude: number;
  destinationLatitude: number;
  destinationLongitude: number;
  mode?: FieldTravelMode;
  avoid?: FieldAvoidOption[];
  alternatives?: boolean;
};

function parseFieldCheckIn(payload: unknown): FieldCheckInResult {
  const root = payload as {
    error?: string;
    data?: FieldCheckInResult;
  };
  if (root?.error) {
    throw new Error(root.error);
  }
  const data = root?.data;
  if (
    !data ||
    typeof data.attendance_id !== 'number' ||
    typeof data.check_in !== 'string'
  ) {
    throw new Error(AUTH_ERRORS.CHECK_IN_FAILED);
  }
  return data;
}

function parseFieldCheckOut(payload: unknown): FieldCheckOutResult {
  const root = payload as {
    error?: string;
    data?: FieldCheckOutResult;
  };
  if (root?.error) {
    throw new Error(root.error);
  }
  const data = root?.data;
  if (
    !data ||
    typeof data.attendance_id !== 'number' ||
    typeof data.check_out !== 'string'
  ) {
    throw new Error(AUTH_ERRORS.CHECK_OUT_FAILED);
  }
  return data;
}

function parseFieldStartSession(payload: unknown): FieldStartSessionResult {
  const root = payload as {
    error?: string;
    data?: FieldStartSessionResult;
  };
  if (root?.error) {
    throw new Error(root.error);
  }
  const data = root?.data;
  if (!data || typeof data.session_id !== 'number' || typeof data.state !== 'string') {
    throw new Error(AUTH_ERRORS.START_SESSION_FAILED);
  }
  return data;
}

function parseFieldLocationUpload(payload: unknown): FieldLocationUploadResult {
  const root = payload as {
    error?: string;
    data?: FieldLocationUploadResult;
  };
  if (root?.error) {
    throw new Error(root.error);
  }
  const data = root?.data;
  if (
    !data ||
    typeof data.accepted !== 'number' ||
    typeof data.session_state !== 'string'
  ) {
    throw new Error(AUTH_ERRORS.LOCATION_UPLOAD_FAILED);
  }
  return data;
}

/** Field check-in via POST /api/v1/field/check-in (Bearer token). */
export async function fieldCheckIn(
  accessToken: string,
  body: FieldCheckInPayload,
): Promise<FieldCheckInResult> {
  try {
    const { data } = await api.post(API_ENDPOINTS.FIELD_CHECK_IN, body, {
      headers: { Authorization: `Bearer ${accessToken}` },
      timeout: 60000,
    });
    return parseFieldCheckIn(data);
  } catch (error) {
    throw new Error(extractErrorMessage(error, AUTH_ERRORS.CHECK_IN_FAILED));
  }
}

/** Field check-out via POST /api/v1/field/check-out (Bearer token). */
export async function fieldCheckOut(
  accessToken: string,
  body: FieldCheckOutPayload,
): Promise<FieldCheckOutResult> {
  try {
    const { data } = await api.post(API_ENDPOINTS.FIELD_CHECK_OUT, body, {
      headers: { Authorization: `Bearer ${accessToken}` },
      timeout: 60000,
    });
    return parseFieldCheckOut(data);
  } catch (error) {
    throw new Error(extractErrorMessage(error, AUTH_ERRORS.CHECK_OUT_FAILED));
  }
}

/** Start field tracking via POST /api/v1/field/start-session (Bearer token). */
export async function fieldStartSession(
  accessToken: string,
  body: FieldStartSessionPayload,
): Promise<FieldStartSessionResult> {
  try {
    const { data } = await api.post(API_ENDPOINTS.FIELD_START_SESSION, body, {
      headers: { Authorization: `Bearer ${accessToken}` },
      timeout: 60000,
    });
    return parseFieldStartSession(data);
  } catch (error) {
    throw new Error(extractErrorMessage(error, AUTH_ERRORS.START_SESSION_FAILED));
  }
}

function parseFieldEndSession(payload: unknown): FieldEndSessionResult {
  const root = payload as {
    error?: string;
    data?: FieldEndSessionResult;
  };
  if (root?.error) {
    throw new Error(root.error);
  }
  const data = root?.data;
  if (!data || typeof data.session_id !== 'number' || typeof data.state !== 'string') {
    throw new Error(AUTH_ERRORS.END_SESSION_FAILED);
  }
  return data;
}

/** End field tracking via POST /api/v1/field/end-session (Bearer token). Does not check out. */
export async function fieldEndSession(
  accessToken: string,
  body: FieldEndSessionPayload = {},
): Promise<FieldEndSessionResult> {
  try {
    const { data } = await api.post(API_ENDPOINTS.FIELD_END_SESSION, body, {
      headers: { Authorization: `Bearer ${accessToken}` },
      timeout: 60000,
    });
    return parseFieldEndSession(data);
  } catch (error) {
    throw new Error(extractErrorMessage(error, AUTH_ERRORS.END_SESSION_FAILED));
  }
}

function parseFieldAddStop(payload: unknown): FieldAddStopResult {
  const root = payload as {
    error?: string;
    data?: FieldAddStopResult;
  };
  if (root?.error) {
    throw new Error(root.error);
  }
  const data = root?.data;
  if (!data || typeof data.stop_id !== 'number' || typeof data.session_id !== 'number') {
    throw new Error(AUTH_ERRORS.ADD_STOP_FAILED);
  }
  return data;
}

/** Pin a visit stop via POST /api/v1/field/add-stop (Bearer token). */
export async function fieldAddStop(
  accessToken: string,
  body: FieldAddStopPayload,
): Promise<FieldAddStopResult> {
  try {
    const { data } = await api.post(API_ENDPOINTS.FIELD_ADD_STOP, body, {
      headers: { Authorization: `Bearer ${accessToken}` },
      timeout: 60000,
    });
    const result = parseFieldAddStop(data);
    return result;
  } catch (error) {
    const message = extractErrorMessage(error, AUTH_ERRORS.ADD_STOP_FAILED);
    throw new Error(message);
  }
}

/** Upload GPS points via POST /api/v1/field/location (Bearer token). */
export async function fieldUploadLocation(
  accessToken: string,
  body: FieldLocationUploadPayload,
): Promise<FieldLocationUploadResult> {
  try {
    const { data } = await api.post(API_ENDPOINTS.FIELD_LOCATION, body, {
      headers: { Authorization: `Bearer ${accessToken}` },
      timeout: 60000,
    });
    return parseFieldLocationUpload(data);
  } catch (error) {
    throw new Error(extractErrorMessage(error, AUTH_ERRORS.LOCATION_UPLOAD_FAILED));
  }
}

export type FieldDevicePlatform = 'android' | 'ios';

/** Register FCM device token via POST /api/v1/field/device-token. */
export async function fieldRegisterDeviceToken(
  accessToken: string,
  body: { token: string; platform: FieldDevicePlatform },
): Promise<{ id: number; registered: boolean; platform: FieldDevicePlatform }> {
  try {
    const { data } = await api.post(API_ENDPOINTS.FIELD_DEVICE_TOKEN, body, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    const root = data as {
      error?: string;
      data?: { id?: number; registered?: boolean; platform?: string };
    };
    if (root?.error) {
      throw new Error(root.error);
    }
    if (
      typeof root?.data?.id !== 'number' ||
      root.data.registered !== true ||
      (root.data.platform !== 'android' && root.data.platform !== 'ios')
    ) {
      throw new Error(AUTH_ERRORS.DEVICE_TOKEN_FAILED);
    }
    return {
      id: root.data.id,
      registered: true,
      platform: root.data.platform,
    };
  } catch (error) {
    throw new Error(extractErrorMessage(error, AUTH_ERRORS.DEVICE_TOKEN_FAILED));
  }
}

/** Deactivate FCM device token via DELETE /api/v1/field/device-token. */
export async function fieldUnregisterDeviceToken(
  accessToken: string,
  token?: string,
): Promise<{ deactivated: boolean; count: number }> {
  try {
    const { data } = await api.delete(API_ENDPOINTS.FIELD_DEVICE_TOKEN, {
      headers: { Authorization: `Bearer ${accessToken}` },
      data: token ? { token } : {},
    });
    const root = data as {
      error?: string;
      data?: { deactivated?: boolean; count?: number };
    };
    if (root?.error) {
      throw new Error(root.error);
    }
    return {
      deactivated: root?.data?.deactivated === true,
      count: typeof root?.data?.count === 'number' ? root.data.count : 0,
    };
  } catch (error) {
    throw new Error(extractErrorMessage(error, AUTH_ERRORS.DEVICE_TOKEN_FAILED));
  }
}

/** Open attendance / tracking status via GET /api/v1/field/session (Bearer token). */
export async function fetchFieldSession(
  accessToken: string,
  options?: RequestOptions,
): Promise<FieldSessionFetchResult> {
  try {
    const { data } = await api.get(API_ENDPOINTS.FIELD_SESSION, {
      headers: { Authorization: `Bearer ${accessToken}` },
      signal: options?.signal,
    });
    const root = data as {
      error?: string;
      data?: FieldSessionStatus | null;
      location_tracking_interval_seconds?: number;
    };
    if (root?.error) {
      throw new Error(root.error);
    }
    const locationTrackingIntervalSeconds =
      typeof root?.location_tracking_interval_seconds === 'number'
        ? root.location_tracking_interval_seconds
        : undefined;
    if (root?.data == null) {
      return { status: null, locationTrackingIntervalSeconds };
    }
    const status = root.data;
    if (
      typeof status.attendance_id !== 'number' ||
      typeof status.check_in !== 'string'
    ) {
      throw new Error(AUTH_ERRORS.CHECK_IN_FAILED);
    }
    return { status, locationTrackingIntervalSeconds };
  } catch (error) {
    if (isRequestCanceled(error)) {
      throw error;
    }
    throw new Error(extractErrorMessage(error, AUTH_ERRORS.CHECK_IN_FAILED));
  }
}

/** Attendance calendar via GET /api/v1/field/attendance/calendar (Bearer token). */
export async function fetchAttendanceCalendar(
  accessToken: string,
  dateFrom: string,
  dateTo: string,
  options?: RequestOptions,
): Promise<AttendanceCalendarResult> {
  try {
    const { data } = await api.get(API_ENDPOINTS.FIELD_ATTENDANCE_CALENDAR, {
      headers: { Authorization: `Bearer ${accessToken}` },
      params: { from: dateFrom, to: dateTo },
      signal: options?.signal,
    });

    const root = data as {
      error?: string;
      data?: AttendanceCalendarResult;
    };
    if (root?.error) {
      throw new Error(root.error);
    }
    if (!root?.data || !Array.isArray(root.data.days)) {
      throw new Error(AUTH_ERRORS.ATTENDANCE_CALENDAR_FAILED);
    }

    return root.data;
  } catch (error) {
    if (isRequestCanceled(error)) {
      throw error;
    }
    throw new Error(
      extractErrorMessage(error, AUTH_ERRORS.ATTENDANCE_CALENDAR_FAILED),
    );
  }
}

/** Distinct Geo-History years via GET /api/v1/field/history/years (Bearer token). */
export async function fetchFieldHistoryYears(
  accessToken: string,
  options?: RequestOptions,
): Promise<number[]> {
  try {
    const { data } = await api.get(API_ENDPOINTS.FIELD_HISTORY_YEARS, {
      headers: { Authorization: `Bearer ${accessToken}` },
      signal: options?.signal,
    });

    const root = data as {
      error?: string;
      data?: FieldHistoryYearsResult;
    };
    if (root?.error) {
      throw new Error(root.error);
    }
    if (!root?.data || !Array.isArray(root.data.years)) {
      throw new Error(AUTH_ERRORS.HISTORY_YEARS_FAILED);
    }

    return root.data.years.filter(
      (year): year is number => typeof year === 'number' && Number.isFinite(year),
    );
  } catch (error) {
    if (isRequestCanceled(error)) {
      throw error;
    }
    throw new Error(extractErrorMessage(error, AUTH_ERRORS.HISTORY_YEARS_FAILED));
  }
}

/** Geo-History day buckets via GET /api/v1/field/history (Bearer token). */
export async function fetchFieldHistory(
  accessToken: string,
  dateFrom: string,
  dateTo: string,
  options?: RequestOptions,
): Promise<FieldHistoryResult> {
  try {
    const { data } = await api.get(API_ENDPOINTS.FIELD_HISTORY, {
      headers: { Authorization: `Bearer ${accessToken}` },
      params: { from: dateFrom, to: dateTo },
      signal: options?.signal,
    });

    const root = data as {
      error?: string;
      data?: FieldHistoryResult;
    };
    if (root?.error) {
      throw new Error(root.error);
    }
    if (!root?.data || !Array.isArray(root.data.days)) {
      throw new Error(AUTH_ERRORS.HISTORY_FAILED);
    }

    return root.data;
  } catch (error) {
    if (isRequestCanceled(error)) {
      throw error;
    }
    throw new Error(extractErrorMessage(error, AUTH_ERRORS.HISTORY_FAILED));
  }
}

/** Geo-History session list via GET /api/v1/field/history/sessions (Bearer token). */
export async function fetchFieldHistorySessions(
  accessToken: string,
  params: FetchFieldHistorySessionsParams = {},
  options?: RequestOptions,
): Promise<FieldHistorySessionsResult> {
  try {
    const query: Record<string, string | number> = {
      limit: params.limit ?? 50,
      offset: params.offset ?? 0,
    };
    if (params.from) {
      query.from = params.from;
    }
    if (params.to) {
      query.to = params.to;
    }

    const { data } = await api.get(API_ENDPOINTS.FIELD_HISTORY_SESSIONS, {
      headers: { Authorization: `Bearer ${accessToken}` },
      params: query,
      signal: options?.signal,
    });

    const root = data as {
      error?: string;
      data?: FieldHistorySessionsResult;
    };
    if (root?.error) {
      throw new Error(root.error);
    }
    if (!root?.data || !Array.isArray(root.data.sessions)) {
      throw new Error(AUTH_ERRORS.HISTORY_SESSIONS_FAILED);
    }

    return root.data;
  } catch (error) {
    if (isRequestCanceled(error)) {
      throw error;
    }
    throw new Error(
      extractErrorMessage(error, AUTH_ERRORS.HISTORY_SESSIONS_FAILED),
    );
  }
}

/** Geo-History session trail via GET /api/v1/field/sessions/{id}/route (Bearer token). */
export async function fetchFieldSessionRoute(
  accessToken: string,
  sessionId: number,
  params: FetchFieldSessionRouteParams = {},
  options?: RequestOptions,
): Promise<FieldSessionRouteResult> {
  try {
    const query: Record<string, number> = {};
    if (params.max_points != null) {
      query.max_points = params.max_points;
    }

    const { data } = await api.get(fieldSessionRoutePath(sessionId), {
      headers: { Authorization: `Bearer ${accessToken}` },
      params: query,
      signal: options?.signal,
    });

    const root = data as {
      error?: string;
      data?: FieldSessionRouteResult;
    };
    if (root?.error) {
      throw new Error(root.error);
    }
    const route = root?.data;
    if (
      !route ||
      typeof route.session_id !== 'number' ||
      (route.trail_source !== 'points' &&
        route.trail_source !== 'polyline' &&
        route.trail_source !== 'purged') ||
      !Array.isArray(route.stops) ||
      !Array.isArray(route.tasks)
    ) {
      throw new Error(AUTH_ERRORS.SESSION_ROUTE_FAILED);
    }

    return route;
  } catch (error) {
    if (isRequestCanceled(error)) {
      throw error;
    }
    throw new Error(
      extractErrorMessage(error, AUTH_ERRORS.SESSION_ROUTE_FAILED),
    );
  }
}

/** Geo-History session detail via GET /api/v1/field/sessions/{id} (Bearer token). */
export async function fetchFieldSessionDetail(
  accessToken: string,
  sessionId: number,
  options?: RequestOptions,
): Promise<FieldSessionDetail> {
  try {
    const { data } = await api.get(fieldSessionPath(sessionId), {
      headers: { Authorization: `Bearer ${accessToken}` },
      signal: options?.signal,
    });

    const root = data as {
      error?: string;
      data?: FieldSessionDetail;
    };
    if (root?.error) {
      throw new Error(root.error);
    }
    const detail = root?.data;
    if (
      !detail ||
      typeof detail.session_id !== 'number' ||
      !Array.isArray(detail.stops) ||
      !Array.isArray(detail.tasks)
    ) {
      throw new Error(AUTH_ERRORS.SESSION_DETAIL_FAILED);
    }

    return detail;
  } catch (error) {
    if (isRequestCanceled(error)) {
      throw error;
    }
    throw new Error(
      extractErrorMessage(error, AUTH_ERRORS.SESSION_DETAIL_FAILED),
    );
  }
}

/** Visit stop detail via GET /api/v1/field/stops/{id} (Bearer token). */
export async function fetchFieldStopDetail(
  accessToken: string,
  stopId: number,
  params: FetchFieldStopDetailParams = {},
  options?: RequestOptions,
): Promise<FieldStopDetail> {
  try {
    const query: Record<string, number | boolean> = {};
    if (params.include_images) {
      query.include_images = true;
    }

    const { data } = await api.get(fieldStopPath(stopId), {
      headers: { Authorization: `Bearer ${accessToken}` },
      params: query,
      signal: options?.signal,
    });

    const root = data as {
      error?: string;
      data?: FieldStopDetail;
    };
    if (root?.error) {
      throw new Error(root.error);
    }
    const stop = root?.data;
    if (!stop || typeof stop.stop_id !== 'number') {
      throw new Error(AUTH_ERRORS.STOP_DETAIL_FAILED);
    }

    return {
      ...stop,
      images: Array.isArray(stop.images) ? stop.images : [],
    };
  } catch (error) {
    if (isRequestCanceled(error)) {
      throw error;
    }
    throw new Error(extractErrorMessage(error, AUTH_ERRORS.STOP_DETAIL_FAILED));
  }
}

/** Employee leave list via GET /api/v1/records/hr.leave (Bearer token). */
export async function fetchHrLeaves(
  accessToken: string,
  employeeId: number,
  params: FetchHrLeavesParams = {},
  options?: RequestOptions,
): Promise<HrLeaveRecord[]> {
  const limit = params.limit ?? 20;
  const offset = params.offset ?? 0;
  const domain = JSON.stringify([['employee_id', '=', employeeId]]);

  console.log('[TimeOff] fetchHrLeaves start', {
    employeeId,
    domain,
    limit,
    offset,
  });

  try {
    const { data } = await api.get(API_ENDPOINTS.HR_LEAVE, {
      headers: { Authorization: `Bearer ${accessToken}` },
      params: {
        domain,
        order: 'request_date_from desc',
        fields:
          'holiday_status_id,request_date_from,request_date_to,number_of_days,state,can_cancel,supported_attachment_ids_count,name',
        limit,
        offset,
      },
      signal: options?.signal,
      timeout: 30000,
    });

    const root = data as {
      error?: string;
      data?: HrLeaveRecord[];
    };
    if (root?.error) {
      throw new Error(root.error);
    }
    if (!Array.isArray(root?.data)) {
      throw new Error(AUTH_ERRORS.HR_LEAVES_FAILED);
    }

    console.log('[TimeOff] fetchHrLeaves success', {
      count: root.data.length,
    });
    return root.data;
  } catch (error) {
    if (isRequestCanceled(error)) {
      throw error;
    }
    const message = extractErrorMessage(
      error,
      AUTH_ERRORS.HR_LEAVES_FAILED,
    );
    console.log('[TimeOff] fetchHrLeaves error', { message });
    throw new Error(message);
  }
}

/** Leave types via GET /api/v1/records/hr.leave.type (Bearer token). */
export async function fetchHrLeaveTypes(
  accessToken: string,
  options?: RequestOptions,
): Promise<HrLeaveType[]> {
  console.log('[TimeOff] fetchHrLeaveTypes start');

  try {
    const { data } = await api.get(API_ENDPOINTS.HR_LEAVE_TYPE, {
      headers: { Authorization: `Bearer ${accessToken}` },
      params: {
        fields:
          'name,request_unit,unpaid,requires_allocation,has_valid_allocation,support_document,virtual_remaining_leaves,max_leaves,leaves_taken',
      },
      signal: options?.signal,
      timeout: 30000,
    });

    const root = data as {
      error?: string;
      data?: HrLeaveType[];
    };
    if (root?.error) {
      throw new Error(root.error);
    }
    if (!Array.isArray(root?.data)) {
      throw new Error(AUTH_ERRORS.HR_LEAVE_TYPES_FAILED);
    }

    console.log('[TimeOff] fetchHrLeaveTypes success', {
      count: root.data.length,
    });
    return root.data;
  } catch (error) {
    if (isRequestCanceled(error)) {
      throw error;
    }
    const message = extractErrorMessage(
      error,
      AUTH_ERRORS.HR_LEAVE_TYPES_FAILED,
    );
    console.log('[TimeOff] fetchHrLeaveTypes error', { message });
    throw new Error(message);
  }
}

function parseCreatedHrLeaveId(payload: unknown): number | null {
  if (!payload || typeof payload !== 'object') {
    return null;
  }
  const root = payload as { id?: unknown; data?: { id?: unknown } };
  if (typeof root.id === 'number') {
    return root.id;
  }
  if (root.data && typeof root.data.id === 'number') {
    return root.data.id;
  }
  return null;
}

/** Create leave via POST /api/v1/records/hr.leave (Bearer token). */
export async function createHrLeave(
  accessToken: string,
  body: CreateHrLeaveBody,
  options?: RequestOptions,
): Promise<number> {
  console.log('[TimeOff] createHrLeave start', {
    holiday_status_id: body.holiday_status_id,
    employee_id: body.employee_id,
    request_date_from: body.request_date_from,
    request_date_to: body.request_date_to,
    name: body.name,
    request_date_from_period: body.request_date_from_period,
    request_date_to_period: body.request_date_to_period,
  });

  try {
    const { data } = await api.post(API_ENDPOINTS.HR_LEAVE, body, {
      headers: { Authorization: `Bearer ${accessToken}` },
      signal: options?.signal,
    });

    const root = data as { error?: string };
    if (root?.error) {
      throw new Error(root.error);
    }

    const leaveId = parseCreatedHrLeaveId(data);
    if (leaveId == null) {
      throw new Error(AUTH_ERRORS.HR_LEAVE_CREATE_FAILED);
    }

    console.log('[TimeOff] createHrLeave success', { leaveId });
    return leaveId;
  } catch (error) {
    if (isRequestCanceled(error)) {
      throw error;
    }
    const message = extractErrorMessage(
      error,
      AUTH_ERRORS.HR_LEAVE_CREATE_FAILED,
    );
    console.log('[TimeOff] createHrLeave error', { message });
    throw new Error(message);
  }
}

/** Upload leave attachment via POST .../hr.leave/{id}/attachments (multipart). */
export async function uploadHrLeaveAttachment(
  accessToken: string,
  leaveId: number,
  file: HrLeaveAttachmentFile,
  options?: RequestOptions,
): Promise<void> {
  console.log('[TimeOff] uploadHrLeaveAttachment start', {
    leaveId,
    name: file.name,
    type: file.type,
  });

  try {
    const form = new FormData();
    form.append('file', {
      uri: file.uri,
      name: file.name,
      type: file.type || 'application/octet-stream',
    } as unknown as Blob);

    const { data } = await api.post(hrLeaveAttachmentsPath(leaveId), form, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'multipart/form-data',
      },
      signal: options?.signal,
      timeout: 60000,
    });

    const root = data as { error?: string };
    if (root?.error) {
      throw new Error(root.error);
    }

    console.log('[TimeOff] uploadHrLeaveAttachment success', {
      leaveId,
      name: file.name,
    });
  } catch (error) {
    if (isRequestCanceled(error)) {
      throw error;
    }
    const message = extractErrorMessage(
      error,
      AUTH_ERRORS.HR_LEAVE_ATTACHMENT_FAILED,
    );
    console.log('[TimeOff] uploadHrLeaveAttachment error', { message });
    throw new Error(message);
  }
}

/** Task routing list via GET /api/v1/field/tasks (Bearer token). */
export async function fetchFieldTasks(
  accessToken: string,
  params: FetchFieldTasksParams = {},
  options?: RequestOptions,
): Promise<FieldTaskListResult> {
  try {
    const query: Record<string, string | number> = {
      status: params.status ?? 'all',
      limit: params.limit ?? 10,
      offset: params.offset ?? 0,
    };
    if (
      typeof params.latitude === 'number' &&
      typeof params.longitude === 'number'
    ) {
      query.latitude = params.latitude;
      query.longitude = params.longitude;
    }
    if (typeof params.from === 'string' && params.from.trim()) {
      query.from = params.from.trim();
    }
    if (typeof params.to === 'string' && params.to.trim()) {
      query.to = params.to.trim();
    }
    if (typeof params.date_field === 'string' && params.date_field.trim()) {
      query.date_field = params.date_field.trim();
    }

    const { data } = await api.get(API_ENDPOINTS.FIELD_TASKS, {
      headers: { Authorization: `Bearer ${accessToken}` },
      params: query,
      signal: options?.signal,
    });

    const root = data as {
      error?: string;
      data?: FieldTaskListResult;
    };
    if (root?.error) {
      throw new Error(root.error);
    }
    if (!root?.data || !Array.isArray(root.data.tasks)) {
      throw new Error(AUTH_ERRORS.TASKS_FAILED);
    }

    return root.data;
  } catch (error) {
    if (isRequestCanceled(error)) {
      throw error;
    }
    throw new Error(extractErrorMessage(error, AUTH_ERRORS.TASKS_FAILED));
  }
}

/** Task detail via GET /api/v1/field/tasks/{taskId} (Bearer token). */
export async function fetchFieldTaskDetail(
  accessToken: string,
  taskId: number,
  options?: RequestOptions,
): Promise<FieldTaskDetail> {
  try {
    const { data } = await api.get(fieldTaskPath(taskId), {
      headers: { Authorization: `Bearer ${accessToken}` },
      signal: options?.signal,
    });

    const root = data as {
      error?: string;
      data?: FieldTaskDetail;
    };
    if (root?.error) {
      throw new Error(root.error);
    }
    const detail = root?.data;
    if (
      !detail ||
      typeof detail.task_id !== 'number' ||
      !detail.checklist ||
      !Array.isArray(detail.checklist.todo) ||
      !Array.isArray(detail.checklist.before_submit)
    ) {
      throw new Error(AUTH_ERRORS.TASK_DETAIL_FAILED);
    }

    return detail;
  } catch (error) {
    if (isRequestCanceled(error)) {
      throw error;
    }
    throw new Error(extractErrorMessage(error, AUTH_ERRORS.TASK_DETAIL_FAILED));
  }
}

export type StartFieldTaskParams = {
  latitude: number;
  longitude: number;
  accuracy?: number;
  point_uuid?: string;
  device_timestamp?: string;
};

/** Start a field task via POST /api/v1/field/tasks/{taskId}/start. */
export async function startFieldTask(
  accessToken: string,
  taskId: number,
  params: StartFieldTaskParams,
  options?: RequestOptions,
): Promise<FieldTaskDetail> {
  try {
    const body: Record<string, unknown> = {
      latitude: params.latitude,
      longitude: params.longitude,
    };
    if (params.accuracy != null) {
      body.accuracy = params.accuracy;
    }
    if (params.point_uuid) {
      body.point_uuid = params.point_uuid;
    }
    if (params.device_timestamp) {
      body.device_timestamp = params.device_timestamp;
    }

    const { data } = await api.post(fieldTaskStartPath(taskId), body, {
      headers: { Authorization: `Bearer ${accessToken}` },
      signal: options?.signal,
    });

    const root = data as { error?: string; data?: FieldTaskDetail };
    if (root?.error) {
      throw new Error(root.error);
    }
    const task = root?.data;
    if (!task || typeof task.task_id !== 'number') {
      throw new Error(AUTH_ERRORS.TASK_START_FAILED);
    }
    return task;
  } catch (error) {
    if (isRequestCanceled(error)) {
      throw error;
    }
    throw new Error(extractErrorMessage(error, AUTH_ERRORS.TASK_START_FAILED));
  }
}

export type ArriveFieldTaskParams = {
  latitude: number;
  longitude: number;
  accuracy?: number;
  point_uuid?: string;
  stop_uuid?: string;
  device_timestamp?: string;
};

/** Mark arrived via POST /api/v1/field/tasks/{taskId}/arrive. */
export async function arriveFieldTask(
  accessToken: string,
  taskId: number,
  params: ArriveFieldTaskParams,
  options?: RequestOptions,
): Promise<ArriveFieldTaskResult> {
  try {
    const body: Record<string, unknown> = {
      latitude: params.latitude,
      longitude: params.longitude,
    };
    if (params.accuracy != null) {
      body.accuracy = params.accuracy;
    }
    if (params.point_uuid) {
      body.point_uuid = params.point_uuid;
    }
    if (params.stop_uuid) {
      body.stop_uuid = params.stop_uuid;
    }
    if (params.device_timestamp) {
      body.device_timestamp = params.device_timestamp;
    }

    const { data } = await api.post(fieldTaskArrivePath(taskId), body, {
      headers: { Authorization: `Bearer ${accessToken}` },
      signal: options?.signal,
    });

    const root = data as {
      error?: string;
      data?: ArriveFieldTaskResult;
    };
    if (root?.error) {
      throw new Error(root.error);
    }
    const result = root?.data;
    if (
      !result?.task ||
      typeof result.task.task_id !== 'number' ||
      !result.stop ||
      typeof result.stop.stop_id !== 'number'
    ) {
      throw new Error(AUTH_ERRORS.TASK_ARRIVE_FAILED);
    }
    return result;
  } catch (error) {
    if (isRequestCanceled(error)) {
      throw error;
    }
    throw new Error(extractErrorMessage(error, AUTH_ERRORS.TASK_ARRIVE_FAILED));
  }
}

export type CompleteFieldTaskParams = {
  checklist_done?: number[];
  latitude?: number;
  longitude?: number;
  accuracy?: number;
  point_uuid?: string;
  device_timestamp?: string;
  note?: string;
};

/** Complete task via POST /api/v1/field/tasks/{taskId}/complete. */
export async function completeFieldTask(
  accessToken: string,
  taskId: number,
  params: CompleteFieldTaskParams = {},
  options?: RequestOptions,
): Promise<CompleteFieldTaskResult> {
  try {
    const body: Record<string, unknown> = {};
    if (params.checklist_done) {
      body.checklist_done = params.checklist_done;
    }
    if (params.latitude != null && params.longitude != null) {
      body.latitude = params.latitude;
      body.longitude = params.longitude;
    }
    if (params.accuracy != null) {
      body.accuracy = params.accuracy;
    }
    if (params.point_uuid) {
      body.point_uuid = params.point_uuid;
    }
    if (params.device_timestamp) {
      body.device_timestamp = params.device_timestamp;
    }
    if (params.note != null) {
      body.note = params.note;
    }

    const { data } = await api.post(fieldTaskCompletePath(taskId), body, {
      headers: { Authorization: `Bearer ${accessToken}` },
      signal: options?.signal,
    });

    const root = data as {
      error?: string;
      data?: CompleteFieldTaskResult;
    };
    if (root?.error) {
      throw new Error(root.error);
    }
    const result = root?.data;
    if (!result?.task || typeof result.task.task_id !== 'number') {
      throw new Error(AUTH_ERRORS.TASK_COMPLETE_FAILED);
    }
    return result;
  } catch (error) {
    if (isRequestCanceled(error)) {
      throw error;
    }
    throw new Error(
      extractErrorMessage(error, AUTH_ERRORS.TASK_COMPLETE_FAILED),
    );
  }
}

export type CancelFieldTaskParams = {
  reason: string;
  note?: string;
};

/** Cancel task via POST /api/v1/field/tasks/{taskId}/cancel. */
export async function cancelFieldTask(
  accessToken: string,
  taskId: number,
  params: CancelFieldTaskParams,
  options?: RequestOptions,
): Promise<FieldTask> {
  try {
    const body: Record<string, unknown> = {
      reason: params.reason,
    };
    if (params.note != null) {
      body.note = params.note;
    }

    const { data } = await api.post(fieldTaskCancelPath(taskId), body, {
      headers: { Authorization: `Bearer ${accessToken}` },
      signal: options?.signal,
    });

    const root = data as { error?: string; data?: FieldTask };
    if (root?.error) {
      throw new Error(root.error);
    }
    const task = root?.data;
    if (!task || typeof task.task_id !== 'number') {
      throw new Error(AUTH_ERRORS.TASK_CANCEL_FAILED);
    }
    return task;
  } catch (error) {
    if (isRequestCanceled(error)) {
      throw error;
    }
    throw new Error(extractErrorMessage(error, AUTH_ERRORS.TASK_CANCEL_FAILED));
  }
}

export type PauseFieldTaskParams = {
  reason: string;
  note?: string;
  latitude?: number;
  longitude?: number;
  accuracy?: number;
  point_uuid?: string;
  device_timestamp?: string;
};

/** Pause task via POST /api/v1/field/tasks/{taskId}/pause. */
export async function pauseFieldTask(
  accessToken: string,
  taskId: number,
  params: PauseFieldTaskParams,
  options?: RequestOptions,
): Promise<FieldTaskDetail> {
  try {
    const body: Record<string, unknown> = {
      reason: params.reason,
    };
    if (params.note != null) {
      body.note = params.note;
    }
    if (params.latitude != null && params.longitude != null) {
      body.latitude = params.latitude;
      body.longitude = params.longitude;
    }
    if (params.accuracy != null) {
      body.accuracy = params.accuracy;
    }
    if (params.point_uuid) {
      body.point_uuid = params.point_uuid;
    }
    if (params.device_timestamp) {
      body.device_timestamp = params.device_timestamp;
    }

    const { data } = await api.post(fieldTaskPausePath(taskId), body, {
      headers: { Authorization: `Bearer ${accessToken}` },
      signal: options?.signal,
    });

    const root = data as { error?: string; data?: FieldTaskDetail };
    if (root?.error) {
      throw new Error(root.error);
    }
    const task = root?.data;
    if (!task || typeof task.task_id !== 'number') {
      throw new Error(AUTH_ERRORS.TASK_PAUSE_FAILED);
    }
    return task;
  } catch (error) {
    if (isRequestCanceled(error)) {
      throw error;
    }
    throw new Error(extractErrorMessage(error, AUTH_ERRORS.TASK_PAUSE_FAILED));
  }
}

/** PATCH /api/v1/field/stops/{stopId} — visit note. */
export async function patchFieldStopNote(
  accessToken: string,
  stopId: number,
  note: string,
  options?: RequestOptions,
): Promise<FieldStopPayload> {
  try {
    const { data } = await api.patch(
      fieldStopPath(stopId),
      { note },
      {
        headers: { Authorization: `Bearer ${accessToken}` },
        signal: options?.signal,
      },
    );
    const root = data as { error?: string; data?: FieldStopPayload };
    if (root?.error) {
      throw new Error(root.error);
    }
    const stop = root?.data;
    if (!stop || typeof stop.stop_id !== 'number') {
      throw new Error(AUTH_ERRORS.STOP_UPDATE_FAILED);
    }
    return stop;
  } catch (error) {
    if (isRequestCanceled(error)) {
      throw error;
    }
    throw new Error(
      extractErrorMessage(error, AUTH_ERRORS.STOP_UPDATE_FAILED),
    );
  }
}

/** POST /api/v1/field/stops/{stopId}/selfie */
export async function uploadStopSelfie(
  accessToken: string,
  stopId: number,
  selfie: string,
  options?: RequestOptions,
): Promise<FieldStopPayload> {
  try {
    const { data } = await api.post(
      fieldStopSelfiePath(stopId),
      { selfie },
      {
        headers: { Authorization: `Bearer ${accessToken}` },
        signal: options?.signal,
        timeout: 60000,
      },
    );
    const root = data as { error?: string; data?: FieldStopPayload };
    if (root?.error) {
      throw new Error(root.error);
    }
    const stop = root?.data;
    if (!stop || typeof stop.stop_id !== 'number') {
      throw new Error(AUTH_ERRORS.STOP_SELFIE_FAILED);
    }
    return stop;
  } catch (error) {
    if (isRequestCanceled(error)) {
      throw error;
    }
    throw new Error(
      extractErrorMessage(error, AUTH_ERRORS.STOP_SELFIE_FAILED),
    );
  }
}

export type StopImageUpload = {
  name: string;
  image: string;
  image_uuid?: string;
};

/** POST /api/v1/field/stops/{stopId}/images */
export async function uploadStopImages(
  accessToken: string,
  stopId: number,
  images: StopImageUpload[],
  options?: RequestOptions,
): Promise<FieldStopPayload> {
  try {
    const { data } = await api.post(
      fieldStopImagesPath(stopId),
      { images },
      {
        headers: { Authorization: `Bearer ${accessToken}` },
        signal: options?.signal,
        timeout: 120000,
      },
    );
    const root = data as { error?: string; data?: FieldStopPayload };
    if (root?.error) {
      throw new Error(root.error);
    }
    const stop = root?.data;
    if (!stop || typeof stop.stop_id !== 'number') {
      throw new Error(AUTH_ERRORS.STOP_IMAGES_FAILED);
    }
    return stop;
  } catch (error) {
    if (isRequestCanceled(error)) {
      throw error;
    }
    throw new Error(
      extractErrorMessage(error, AUTH_ERRORS.STOP_IMAGES_FAILED),
    );
  }
}

/** Company Maps JS key + whether maps are configured (from Odoo map-config). */
export async function fetchFieldMapConfig(
  accessToken: string,
  options?: RequestOptions,
): Promise<FieldMapConfig> {
  try {
    const { data } = await api.get(API_ENDPOINTS.FIELD_MAP_CONFIG, {
      headers: { Authorization: `Bearer ${accessToken}` },
      signal: options?.signal,
    });
    const root = data as {
      error?: string;
      data?: {
        maps_configured?: boolean;
        google_maps_api_key?: string | null | false;
      };
    };
    if (root?.error) {
      throw new Error(root.error);
    }
    if (!root?.data || typeof root.data.maps_configured !== 'boolean') {
      throw new Error(AUTH_ERRORS.DIRECTIONS_FAILED);
    }
    const rawKey = root.data.google_maps_api_key;
    const google_maps_api_key =
      typeof rawKey === 'string' && rawKey.trim().length > 0
        ? rawKey.trim()
        : null;
    return {
      maps_configured: root.data.maps_configured && Boolean(google_maps_api_key),
      google_maps_api_key,
    };
  } catch (error) {
    if (isRequestCanceled(error)) {
      throw error;
    }
    throw new Error(extractErrorMessage(error, AUTH_ERRORS.DIRECTIONS_FAILED));
  }
}

/** Route polyline via Odoo Directions proxy (company Google key stays on server). */
export async function fetchFieldDirections(
  accessToken: string,
  params: FetchFieldDirectionsParams,
  options?: RequestOptions,
): Promise<FieldDirectionsResult> {
  try {
    const { data } = await api.post(
      API_ENDPOINTS.FIELD_DIRECTIONS,
      {
        origin_latitude: params.originLatitude,
        origin_longitude: params.originLongitude,
        destination_latitude: params.destinationLatitude,
        destination_longitude: params.destinationLongitude,
        mode: params.mode ?? 'driving',
        avoid: params.avoid ?? [],
        alternatives: params.alternatives ?? true,
      },
      {
        headers: { Authorization: `Bearer ${accessToken}` },
        signal: options?.signal,
      },
    );

    const root = data as { error?: string; data?: FieldDirectionsResult };
    if (root?.error) {
      throw new Error(root.error);
    }
    if (!root?.data || !Array.isArray(root.data.coordinates)) {
      throw new Error(AUTH_ERRORS.DIRECTIONS_FAILED);
    }
    return root.data;
  } catch (error) {
    if (isRequestCanceled(error)) {
      throw error;
    }
    throw new Error(extractErrorMessage(error, AUTH_ERRORS.DIRECTIONS_FAILED));
  }
}

/** Compute ISO expiry from OAuth `expires_in` (seconds). */
export function accessTokenExpiresAtFromExpiresIn(expiresIn: number): string {
  const seconds = Number.isFinite(expiresIn) && expiresIn > 0 ? expiresIn : 3600;
  return new Date(Date.now() + seconds * 1000).toISOString();
}

function extractErrorMessage(error: unknown, fallback: string): string {
  if (isRequestCanceled(error)) {
    return 'canceled';
  }
  if (axios.isAxiosError(error)) {
    if (error.code === 'ECONNABORTED') {
      return AUTH_ERRORS.REQUEST_TIMEOUT;
    }
    // No HTTP response → offline, unreachable host, or RN "Network Error".
    if (!error.response) {
      return AUTH_ERRORS.NETWORK_ERROR;
    }

    const data = error.response.data as
      | {
          error?: string;
          code?: string;
          detail?: string;
          result?: { error?: string };
        }
      | undefined;
    if (data?.code && typeof data.code === 'string') {
      return data.code;
    }
    if (data?.error && typeof data.error === 'string') {
      return data.error;
    }
    if (data?.detail && typeof data.detail === 'string') {
      return data.detail;
    }
    if (data?.result?.error) {
      return data.result.error;
    }

    const status = error.response.status;
    if (status === 401) {
      return AUTH_ERRORS.UNAUTHORIZED;
    }
    if (status === 409) {
      return AUTH_ERRORS.CONFLICT;
    }
    if (status === 429) {
      return AUTH_ERRORS.RATE_LIMITED;
    }

    if (error.message) {
      return error.message;
    }
  }
  if (error instanceof Error && error.message) {
    return error.message;
  }
  return fallback;
}

export async function searchCompany(
  website: string,
  mode: 'light' | 'dark',
): Promise<CompanySearchResult> {
  try {
    const { data } = await api.get(API_ENDPOINTS.COMPANY_SEARCH, {
      params: { website, mode },
    });

    if (data?.error) {
      throw new Error(data.error);
    }

    return data as CompanySearchResult;
  } catch (error) {
    throw new Error(extractErrorMessage(error, AUTH_ERRORS.SEARCH_FAILED));
  }
}

export async function mobileLogin(params: {
  company_reference: string;
  email: string;
  password: string;
}): Promise<MobileLoginResult> {
  try {
    const { data } = await api.post(API_ENDPOINTS.MOBILE_LOGIN, {
      email: params.email,
      password: params.password,
      company_reference: params.company_reference,
      require_field_employee: true,
      scopes: 'read write',
    });

    if (data?.error) {
      throw new Error(data.error);
    }

    if (
      !data?.access_token ||
      !data?.refresh_token ||
      !data?.employee ||
      typeof data.expires_in !== 'number'
    ) {
      throw new Error(AUTH_ERRORS.LOGIN_FAILED);
    }

    return {
      access_token: data.access_token,
      refresh_token: data.refresh_token,
      expires_in: data.expires_in,
      employee: data.employee as MobileEmployee,
    };
  } catch (error) {
    throw new Error(extractErrorMessage(error, AUTH_ERRORS.LOGIN_FAILED));
  }
}

export async function refreshAccessToken(
  refreshToken: string,
): Promise<TokenRefreshResult> {
  try {
    const { data } = await api.post(API_ENDPOINTS.AUTH_REFRESH, {
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
    });

    const payload = data?.data ?? data;
    if (payload?.error) {
      throw new Error(payload.error);
    }
    if (
      !payload?.access_token ||
      !payload?.refresh_token ||
      typeof payload.expires_in !== 'number'
    ) {
      throw new Error(AUTH_ERRORS.UNAUTHORIZED);
    }

    return {
      access_token: payload.access_token,
      refresh_token: payload.refresh_token,
      expires_in: payload.expires_in,
    };
  } catch (error) {
    throw new Error(extractErrorMessage(error, AUTH_ERRORS.UNAUTHORIZED));
  }
}

/** Revoke an OAuth access or refresh token via REST logout. */
export async function revokeToken(token: string): Promise<void> {
  try {
    const { data } = await api.post(API_ENDPOINTS.AUTH_REVOKE, { token });
    const payload = data?.data ?? data;
    if (payload?.error) {
      throw new Error(payload.error);
    }
  } catch (error) {
    throw new Error(extractErrorMessage(error, AUTH_ERRORS.UNAUTHORIZED));
  }
}

function parseMeEmployee(payload: unknown): MobileEmployee {
  const root = payload as {
    error?: string;
    data?: { name?: string; employee?: MobileEmployee };
    employee?: MobileEmployee;
  };
  if (root?.error) {
    throw new Error(root.error);
  }
  const employee = root?.data?.employee ?? root?.employee;
  if (!employee || typeof employee.name !== 'string') {
    throw new Error(AUTH_ERRORS.PROFILE_FAILED);
  }
  const userName = root?.data?.name;
  return {
    ...employee,
    // Prefer res.users name when present
    name:
      typeof userName === 'string' && userName.trim()
        ? userName
        : employee.name,
  };
}

/** Current user employee profile via GET /api/v1/me. */
export async function fetchMe(
  accessToken: string,
  options?: RequestOptions,
): Promise<MobileEmployee> {
  try {
    const { data } = await api.get(API_ENDPOINTS.ME, {
      headers: { Authorization: `Bearer ${accessToken}` },
      signal: options?.signal,
    });
    
    return parseMeEmployee(data);
  } catch (error) {
    if (isRequestCanceled(error)) {
      throw error;
    }
    throw new Error(extractErrorMessage(error, AUTH_ERRORS.PROFILE_FAILED));
  }
}

/** Update current user profile via PATCH /api/v1/me (name / work_phone / avatar). */
export async function updateMe(
  accessToken: string,
  body: MeProfileUpdate,
): Promise<MobileEmployee> {
  try {
    const { data } = await api.patch(API_ENDPOINTS.ME, body, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    return parseMeEmployee(data);
  } catch (error) {
    throw new Error(
      extractErrorMessage(error, AUTH_ERRORS.PROFILE_UPDATE_FAILED),
    );
  }
}

