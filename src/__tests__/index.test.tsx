import { describe, expect, it } from '@jest/globals';
import type { TrackingOptions } from '../types';

describe('public types', () => {
  it('accepts tracking option defaults shape', () => {
    const options: TrackingOptions = {
      intervalMs: 30_000,
      fastestIntervalMs: 15_000,
      distanceFilterM: 25,
      maxLocationAgeMs: 60_000,
      accuracy: 'high',
      notificationTitle: 'Tracking',
      notificationText: 'Active',
    };
    expect(options.intervalMs).toBe(30_000);
    expect(options.maxLocationAgeMs).toBe(60_000);
    expect(options.accuracy).toBe('high');
  });
});
