import { NativeEventEmitter, type EmitterSubscription } from 'react-native';
import NativeBackgroundLocation from './NativeBackgroundLocation';
import type {
  LocationErrorEvent,
  LocationPoint,
  LocationWarningEvent,
} from './types';

const emitter = new NativeEventEmitter(NativeBackgroundLocation);

function debugLog(...args: unknown[]): void {
  if (__DEV__) {
    console.log('[EBBgLoc]', ...args);
  }
}

function asRecord(value: unknown): Record<string, unknown> {
  if (value != null && typeof value === 'object') {
    return value as Record<string, unknown>;
  }
  return {};
}

export function addLocationListener(
  callback: (point: LocationPoint) => void
): () => void {
  debugLog('[Lib] addLocationListener');
  const sub: EmitterSubscription = emitter.addListener('location', (raw) => {
    const data = asRecord(raw);
    debugLog('[Lib] location event');
    callback({
      sessionId: String(data.sessionId ?? ''),
      latitude: Number(data.latitude),
      longitude: Number(data.longitude),
      accuracy:
        data.accuracy == null || Number.isNaN(Number(data.accuracy))
          ? null
          : Number(data.accuracy),
      speed:
        data.speed == null || Number.isNaN(Number(data.speed))
          ? null
          : Number(data.speed),
      heading:
        data.heading == null || Number.isNaN(Number(data.heading))
          ? null
          : Number(data.heading),
      altitude:
        data.altitude == null || Number.isNaN(Number(data.altitude))
          ? null
          : Number(data.altitude),
      timestamp: Number(data.timestamp ?? Date.now()),
    });
  });
  return () => {
    debugLog('[Lib] removeLocationListener');
    sub.remove();
  };
}

export function addErrorListener(
  callback: (event: LocationErrorEvent) => void
): () => void {
  debugLog('[Lib] addErrorListener');
  const sub: EmitterSubscription = emitter.addListener('error', (raw) => {
    const data = asRecord(raw);
    debugLog('[Lib] error event', data.code);
    callback({
      code: String(data.code ?? 'UNKNOWN'),
      message: String(data.message ?? ''),
      sessionId: data.sessionId == null ? undefined : String(data.sessionId),
    });
  });
  return () => {
    debugLog('[Lib] removeErrorListener');
    sub.remove();
  };
}

export function addWarningListener(
  callback: (event: LocationWarningEvent) => void
): () => void {
  debugLog('[Lib] addWarningListener');
  const sub: EmitterSubscription = emitter.addListener('warning', (raw) => {
    const data = asRecord(raw);
    debugLog('[Lib] warning event', data.code);
    callback({
      code: String(data.code ?? 'UNKNOWN'),
      message: String(data.message ?? ''),
      sessionId: data.sessionId == null ? undefined : String(data.sessionId),
    });
  });
  return () => {
    debugLog('[Lib] removeWarningListener');
    sub.remove();
  };
}
