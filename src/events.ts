import { NativeEventEmitter, type EmitterSubscription } from 'react-native';
import NativeBackgroundLocation from './NativeBackgroundLocation';
import type {
  LocationErrorEvent,
  LocationPoint,
  LocationWarningEvent,
} from './types';

const emitter = new NativeEventEmitter(NativeBackgroundLocation);

function asRecord(value: unknown): Record<string, unknown> {
  if (value != null && typeof value === 'object') {
    return value as Record<string, unknown>;
  }
  return {};
}

export function addLocationListener(
  callback: (point: LocationPoint) => void
): () => void {
  console.log('[EBBgLoc]', '[Lib] addLocationListener');
  const sub: EmitterSubscription = emitter.addListener('location', (raw) => {
    const data = asRecord(raw);
    console.log('[EBBgLoc]', '[Lib] raw location event', data);
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
    console.log('[EBBgLoc]', '[Lib] removeLocationListener');
    sub.remove();
  };
}

export function addErrorListener(
  callback: (event: LocationErrorEvent) => void
): () => void {
  console.log('[EBBgLoc]', '[Lib] addErrorListener');
  const sub: EmitterSubscription = emitter.addListener('error', (raw) => {
    const data = asRecord(raw);
    console.log('[EBBgLoc]', '[Lib] raw error event', data);
    callback({
      code: String(data.code ?? 'UNKNOWN'),
      message: String(data.message ?? ''),
      sessionId: data.sessionId == null ? undefined : String(data.sessionId),
    });
  });
  return () => {
    console.log('[EBBgLoc]', '[Lib] removeErrorListener');
    sub.remove();
  };
}

export function addWarningListener(
  callback: (event: LocationWarningEvent) => void
): () => void {
  console.log('[EBBgLoc]', '[Lib] addWarningListener');
  const sub: EmitterSubscription = emitter.addListener('warning', (raw) => {
    const data = asRecord(raw);
    console.log('[EBBgLoc]', '[Lib] raw warning event', data);
    callback({
      code: String(data.code ?? 'UNKNOWN'),
      message: String(data.message ?? ''),
      sessionId: data.sessionId == null ? undefined : String(data.sessionId),
    });
  });
  return () => {
    console.log('[EBBgLoc]', '[Lib] removeWarningListener');
    sub.remove();
  };
}
