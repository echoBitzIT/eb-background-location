export type LocationAccuracy = 'high' | 'balanced' | 'low';

export type TrackingOptions = {
  /** Location update interval in ms. Default: 30000. Android-focused; iOS uses distance filter. */
  intervalMs?: number;
  /** Fastest Android update interval in ms. Default: 15000 */
  fastestIntervalMs?: number;
  /** Minimum movement in meters between updates. Default: 25 */
  distanceFilterM?: number;
  /** Desired accuracy. Default: 'high' */
  accuracy?: LocationAccuracy;
  /** Max age of a location fix in ms before rejection. Default: 60000 */
  maxLocationAgeMs?: number;
  /** Android foreground-service notification title */
  notificationTitle?: string;
  /** Android foreground-service notification text */
  notificationText?: string;
};

export type LocationPoint = {
  sessionId: string;
  latitude: number;
  longitude: number;
  accuracy: number | null;
  speed: number | null;
  heading: number | null;
  altitude: number | null;
  timestamp: number;
};

export type PermissionStatus =
  'granted' | 'denied' | 'blocked' | 'undetermined' | 'whenInUse';

export type PermissionResult = {
  status: PermissionStatus;
  canRequestAgain: boolean;
};

export type TrackingStatus = {
  active: boolean;
  sessionId?: string;
};

export type LocationWarningCode =
  | 'LOCATION_UNAVAILABLE'
  | 'LOCATION_AVAILABLE'
  | 'TASK_REMOVED'
  | 'SERVICE_TIMEOUT'
  | 'LOCATION_UPDATES_PAUSED'
  | string;

export type LocationErrorEvent = {
  code: string;
  message: string;
  sessionId?: string;
};

export type LocationWarningEvent = {
  code: LocationWarningCode;
  message: string;
  sessionId?: string;
};
