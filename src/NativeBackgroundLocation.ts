import { TurboModuleRegistry, type TurboModule } from 'react-native';

/**
 * Codegen-compatible tracking options.
 * Nested objects are flattened; keep fields primitive.
 */
export interface TrackingOptionsSpec {
  intervalMs?: number;
  fastestIntervalMs?: number;
  distanceFilterM?: number;
  accuracy?: string;
  maxLocationAgeMs?: number;
  notificationTitle?: string;
  notificationText?: string;
}

export interface PermissionStatusResult {
  status: string;
  canRequestAgain: boolean;
}

export interface TrackingStatusResult {
  active: boolean;
  sessionId?: string;
}

export interface LocationPointSpec {
  sessionId: string;
  latitude: number;
  longitude: number;
  accuracy?: number;
  speed?: number;
  heading?: number;
  altitude?: number;
  timestamp: number;
}

export interface Spec extends TurboModule {
  startTracking(
    sessionId: string,
    options?: TrackingOptionsSpec
  ): Promise<void>;

  stopTracking(): Promise<void>;

  isTracking(): Promise<TrackingStatusResult>;

  requestLocationPermission(
    foregroundOnly: boolean
  ): Promise<PermissionStatusResult>;

  requestNotificationPermission(): Promise<string>;

  getLocationPermissionStatus(): Promise<PermissionStatusResult>;

  getSessionLocations(
    sessionId: string,
    limit?: number
  ): Promise<LocationPointSpec[]>;

  clearSessionLocations(sessionId?: string): Promise<void>;

  /** Required by NativeEventEmitter on iOS */
  addListener(eventName: string): void;

  /** Required by NativeEventEmitter on iOS */
  removeListeners(count: number): void;
}

export default TurboModuleRegistry.getEnforcing<Spec>('BackgroundLocation');
