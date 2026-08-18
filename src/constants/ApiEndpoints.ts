export const API_ENDPOINTS = {
  COMPANY_SEARCH: '/api/v1/company/search',
  MOBILE_LOGIN: '/api/v1/auth/login',
  AUTH_REFRESH: '/api/v1/authentication/token',
  AUTH_REVOKE: '/api/v1/authentication/revoke',
  ME: '/api/v1/me',
  FIELD_CHECK_IN: '/api/v1/field/check-in',
  FIELD_CHECK_OUT: '/api/v1/field/check-out',
  FIELD_SESSION: '/api/v1/field/session',
  FIELD_START_SESSION: '/api/v1/field/start-session',
  FIELD_END_SESSION: '/api/v1/field/end-session',
  FIELD_LOCATION: '/api/v1/field/location',
  FIELD_ADD_STOP: '/api/v1/field/add-stop',
  FIELD_ATTENDANCE_CALENDAR: '/api/v1/field/attendance/calendar',
  FIELD_HISTORY: '/api/v1/field/history',
  FIELD_HISTORY_YEARS: '/api/v1/field/history/years',
  FIELD_HISTORY_SESSIONS: '/api/v1/field/history/sessions',
  FIELD_TASKS: '/api/v1/field/tasks',
  FIELD_MAP_CONFIG: '/api/v1/field/map-config',
  FIELD_DIRECTIONS: '/api/v1/field/directions',
  FIELD_DEVICE_TOKEN: '/api/v1/field/device-token',
  HR_LEAVE: '/api/v1/records/hr.leave',
  HR_LEAVE_TYPE: '/api/v1/records/hr.leave.type',
} as const;

export function fieldTaskPath(taskId: number): string {
  return `/api/v1/field/tasks/${taskId}`;
}

export function fieldTaskStartPath(taskId: number): string {
  return `/api/v1/field/tasks/${taskId}/start`;
}

export function fieldTaskArrivePath(taskId: number): string {
  return `/api/v1/field/tasks/${taskId}/arrive`;
}

export function fieldTaskCompletePath(taskId: number): string {
  return `/api/v1/field/tasks/${taskId}/complete`;
}

export function fieldTaskCancelPath(taskId: number): string {
  return `/api/v1/field/tasks/${taskId}/cancel`;
}

export function fieldTaskPausePath(taskId: number): string {
  return `/api/v1/field/tasks/${taskId}/pause`;
}

export function fieldSessionPath(sessionId: number): string {
  return `/api/v1/field/sessions/${sessionId}`;
}

export function fieldSessionRoutePath(sessionId: number): string {
  return `/api/v1/field/sessions/${sessionId}/route`;
}

export function fieldStopPath(stopId: number): string {
  return `/api/v1/field/stops/${stopId}`;
}

export function fieldStopSelfiePath(stopId: number): string {
  return `/api/v1/field/stops/${stopId}/selfie`;
}

export function fieldStopImagesPath(stopId: number): string {
  return `/api/v1/field/stops/${stopId}/images`;
}

export function hrLeaveAttachmentsPath(leaveId: number): string {
  return `/api/v1/records/hr.leave/${leaveId}/attachments`;
}

export const AUTH_ERRORS = {
  RATE_LIMITED: 'rate_limited',
  INVALID_REQUEST: 'invalid_request',
  NOT_FOUND: 'not_found',
  INVALID_SESSION: 'invalid_session',
  INVALID_CREDENTIALS: 'invalid_credentials',
  NOT_FIELD_EMPLOYEE: 'not_field_employee',
  UNAUTHORIZED: 'unauthorized',
  NETWORK_ERROR: 'network_error',
  REQUEST_TIMEOUT: 'request_timeout',
  SEARCH_FAILED: 'search_failed',
  LOGIN_FAILED: 'login_failed',
  PROFILE_FAILED: 'profile_failed',
  PROFILE_UPDATE_FAILED: 'profile_update_failed',
  CHECK_IN_FAILED: 'check_in_failed',
  CHECK_OUT_FAILED: 'check_out_failed',
  NO_ACTIVE_SESSION: 'no_active_session',
  START_SESSION_FAILED: 'start_session_failed',
  END_SESSION_FAILED: 'end_session_failed',
  LOCATION_UNAVAILABLE: 'location_unavailable',
  LOCATION_UPLOAD_FAILED: 'location_upload_failed',
  ADD_STOP_FAILED: 'add_stop_failed',
  STOPS_NOT_ALLOWED: 'FT_STOPS_NOT_ALLOWED',
  STOP_NOTE_REQUIRED: 'FT_STOP_NOTE_REQUIRED',
  SELFIE_REQUIRED_STOP: 'FT_SELFIE_REQUIRED',
  ATTENDANCE_CALENDAR_FAILED: 'attendance_calendar_failed',
  HISTORY_FAILED: 'history_failed',
  HISTORY_YEARS_FAILED: 'history_years_failed',
  HISTORY_SESSIONS_FAILED: 'history_sessions_failed',
  SESSION_ROUTE_FAILED: 'session_route_failed',
  SESSION_DETAIL_FAILED: 'session_detail_failed',
  STOP_DETAIL_FAILED: 'stop_detail_failed',
  HR_LEAVES_FAILED: 'hr_leaves_failed',
  HR_LEAVE_TYPES_FAILED: 'hr_leave_types_failed',
  HR_LEAVE_CREATE_FAILED: 'hr_leave_create_failed',
  HR_LEAVE_ATTACHMENT_FAILED: 'hr_leave_attachment_failed',
  TASKS_FAILED: 'tasks_failed',
  TASK_DETAIL_FAILED: 'task_detail_failed',
  TASK_START_FAILED: 'task_start_failed',
  TASK_ALREADY_ACTIVE: 'FT_TASK_ALREADY_ACTIVE',
  TASKS_NOT_ALLOWED: 'FT_TASKS_NOT_ALLOWED',
  TASK_INVALID_STATE: 'FT_TASK_INVALID_STATE',
  NO_OPEN_ATTENDANCE: 'FT_NO_OPEN_ATTENDANCE',
  GPS_REQUIRED: 'FT_GPS_REQUIRED',
  TASK_TOO_FAR: 'FT_TASK_TOO_FAR',
  TASK_IMAGES_REQUIRED: 'FT_TASK_IMAGES_REQUIRED',
  TASK_CHECKLIST_INCOMPLETE: 'FT_TASK_CHECKLIST_INCOMPLETE',
  STOP_CLOSED: 'FT_STOP_CLOSED',
  TASK_IN_PROGRESS: 'FT_TASK_IN_PROGRESS',
  TOO_MANY_IMAGES: 'FT_TOO_MANY_IMAGES',
  CONFLICT: 'conflict',
  TASK_ARRIVE_FAILED: 'task_arrive_failed',
  TASK_COMPLETE_FAILED: 'task_complete_failed',
  TASK_CANCEL_FAILED: 'task_cancel_failed',
  TASK_PAUSE_FAILED: 'task_pause_failed',
  TASK_PAUSE_NOT_ALLOWED: 'FT_TASK_PAUSE_NOT_ALLOWED',
  PAUSE_REASON_REQUIRED: 'FT_PAUSE_REASON_REQUIRED',
  STOP_UPDATE_FAILED: 'stop_update_failed',
  STOP_SELFIE_FAILED: 'stop_selfie_failed',
  STOP_IMAGES_FAILED: 'stop_images_failed',
  MAPS_NOT_CONFIGURED: 'maps_not_configured',
  DIRECTIONS_FAILED: 'directions_failed',
  DEVICE_TOKEN_FAILED: 'device_token_failed',
} as const;

export type AuthErrorCode = (typeof AUTH_ERRORS)[keyof typeof AUTH_ERRORS];

const AUTH_ERROR_MESSAGES: Record<string, string> = {
  [AUTH_ERRORS.RATE_LIMITED]: 'Too many attempts. Please try again shortly.',
  [AUTH_ERRORS.INVALID_REQUEST]: 'Invalid request. Check the company website and try again.',
  [AUTH_ERRORS.NOT_FOUND]: 'No company found for this website.',
  [AUTH_ERRORS.INVALID_SESSION]:
    'Company session expired. Please search for your company again.',
  [AUTH_ERRORS.INVALID_CREDENTIALS]: 'Invalid email or password.',
  [AUTH_ERRORS.NOT_FIELD_EMPLOYEE]:
    'This account is not registered as a field employee.',
  [AUTH_ERRORS.UNAUTHORIZED]: 'Session expired. Please log in again.',
  [AUTH_ERRORS.NETWORK_ERROR]:
    'No internet connection. Please check your network and try again.',
  [AUTH_ERRORS.REQUEST_TIMEOUT]:
    'The request timed out. Please try again.',
  [AUTH_ERRORS.SEARCH_FAILED]: 'Company search failed. Please try again.',
  [AUTH_ERRORS.LOGIN_FAILED]: 'Login failed. Please try again.',
  [AUTH_ERRORS.PROFILE_FAILED]: 'Could not load profile. Please try again.',
  [AUTH_ERRORS.PROFILE_UPDATE_FAILED]: 'Could not update profile. Please try again.',
  [AUTH_ERRORS.CHECK_IN_FAILED]: 'Check-in failed. Please try again.',
  [AUTH_ERRORS.CHECK_OUT_FAILED]: 'Check-out failed. Please try again.',
  [AUTH_ERRORS.NO_ACTIVE_SESSION]: 'No active tracking session.',
  FT_NO_ACTIVE_SESSION: 'No active tracking session.',
  [AUTH_ERRORS.START_SESSION_FAILED]: 'Could not start tracking session. Please try again.',
  [AUTH_ERRORS.END_SESSION_FAILED]: 'Could not stop tracking session. Please try again.',
  [AUTH_ERRORS.LOCATION_UNAVAILABLE]:
    'Could not get your location. Enable GPS and try again.',
  [AUTH_ERRORS.LOCATION_UPLOAD_FAILED]:
    'Could not upload your location. Please try again.',
  [AUTH_ERRORS.ADD_STOP_FAILED]:
    'Could not save this visit stop. Please try again.',
  [AUTH_ERRORS.STOPS_NOT_ALLOWED]:
    'Adding stops is not allowed by your field tracking policy.',
  [AUTH_ERRORS.STOP_NOTE_REQUIRED]:
    'A visit note is required before you can save this stop.',
  [AUTH_ERRORS.SELFIE_REQUIRED_STOP]:
    'A photo is required before you can save this stop.',
  [AUTH_ERRORS.ATTENDANCE_CALENDAR_FAILED]:
    'Could not load attendance calendar. Please try again.',
  [AUTH_ERRORS.HISTORY_FAILED]:
    'Could not load tracking history. Please try again.',
  [AUTH_ERRORS.HISTORY_YEARS_FAILED]:
    'Could not load history years. Please try again.',
  [AUTH_ERRORS.HISTORY_SESSIONS_FAILED]:
    'Could not load sessions. Please try again.',
  [AUTH_ERRORS.SESSION_ROUTE_FAILED]:
    'Could not load the session route. Please try again.',
  [AUTH_ERRORS.SESSION_DETAIL_FAILED]:
    'Could not load session details. Please try again.',
  [AUTH_ERRORS.STOP_DETAIL_FAILED]:
    'Could not load visit details. Please try again.',
  [AUTH_ERRORS.HR_LEAVES_FAILED]:
    'Could not load time off. Please try again.',
  [AUTH_ERRORS.HR_LEAVE_TYPES_FAILED]:
    'Could not load leave types. Please try again.',
  [AUTH_ERRORS.HR_LEAVE_CREATE_FAILED]:
    'Could not submit time off request. Please try again.',
  [AUTH_ERRORS.HR_LEAVE_ATTACHMENT_FAILED]:
    'Could not upload the attachment. Please try again.',
  [AUTH_ERRORS.TASKS_FAILED]:
    'Could not load tasks. Please try again.',
  [AUTH_ERRORS.TASK_DETAIL_FAILED]:
    'Could not load task details. Please try again.',
  [AUTH_ERRORS.TASK_START_FAILED]:
    'Could not start this task. Please try again.',
  [AUTH_ERRORS.TASK_ALREADY_ACTIVE]:
    'Finish, pause or cancel your current task before starting another.',
  [AUTH_ERRORS.TASKS_NOT_ALLOWED]:
    'Task routing is not allowed by your field tracking policy.',
  [AUTH_ERRORS.TASK_INVALID_STATE]:
    'This task cannot be started in its current state.',
  [AUTH_ERRORS.NO_OPEN_ATTENDANCE]:
    'Check in before starting a task.',
  [AUTH_ERRORS.GPS_REQUIRED]:
    'GPS is required. Enable location and try again.',
  [AUTH_ERRORS.TASK_TOO_FAR]:
    'You are too far from the store. Move closer and try again.',
  [AUTH_ERRORS.TASK_IMAGES_REQUIRED]:
    'Upload the required visit photos before finishing.',
  [AUTH_ERRORS.TASK_CHECKLIST_INCOMPLETE]:
    'Complete every required checklist item before submitting.',
  [AUTH_ERRORS.STOP_CLOSED]:
    'This visit is already closed.',
  [AUTH_ERRORS.TASK_IN_PROGRESS]:
    'Finish, pause or cancel your current task before checking out.',
  [AUTH_ERRORS.TOO_MANY_IMAGES]:
    'You have reached the maximum number of photos for this visit.',
  [AUTH_ERRORS.CONFLICT]:
    'Could not finish this visit. Please try Done again.',
  [AUTH_ERRORS.TASK_ARRIVE_FAILED]:
    'Could not mark arrival. Please try again.',
  [AUTH_ERRORS.TASK_COMPLETE_FAILED]:
    'Could not complete this task. Please try again.',
  [AUTH_ERRORS.TASK_CANCEL_FAILED]:
    'Could not cancel this task. Please try again.',
  [AUTH_ERRORS.TASK_PAUSE_FAILED]:
    'Could not pause this task. Please try again.',
  [AUTH_ERRORS.TASK_PAUSE_NOT_ALLOWED]:
    'Pausing tasks is not allowed by your field tracking policy.',
  [AUTH_ERRORS.PAUSE_REASON_REQUIRED]:
    'Select a pause reason. Add a note when the reason is Other.',
  [AUTH_ERRORS.STOP_UPDATE_FAILED]:
    'Could not save the visit note. Please try again.',
  [AUTH_ERRORS.STOP_SELFIE_FAILED]:
    'Could not upload the selfie. Please try again.',
  [AUTH_ERRORS.STOP_IMAGES_FAILED]:
    'Could not upload photos. Please try again.',
  [AUTH_ERRORS.MAPS_NOT_CONFIGURED]:
    'Maps is not configured for your company. Ask your admin to set the Google Maps API key in Odoo.',
  [AUTH_ERRORS.DIRECTIONS_FAILED]:
    'Could not load the route. Please try again.',
  [AUTH_ERRORS.DEVICE_TOKEN_FAILED]:
    'Could not register this device for notifications.',
};

export function getAuthErrorMessage(errorCode: string | null | undefined): string {
  if (!errorCode) {
    return AUTH_ERROR_MESSAGES[AUTH_ERRORS.LOGIN_FAILED];
  }
  return AUTH_ERROR_MESSAGES[errorCode] ?? errorCode;
}
