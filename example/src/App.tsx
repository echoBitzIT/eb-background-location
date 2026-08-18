import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  AppState,
  Linking,
  Platform,
  Pressable,
  SafeAreaView,
  ScrollView,
  Text,
  View,
} from 'react-native';
import {
  addErrorListener,
  addLocationListener,
  addWarningListener,
  getLocationPermissionStatus,
  getSessionLocations,
  isTracking,
  requestLocationPermission,
  requestNotificationPermission,
  startTracking,
  stopTracking,
  type LocationPoint,
  type PermissionStatus,
  type TrackingOptions,
} from '@eb/react-native-background-location';
import styles from './styles';

type ConfigPreset = 'default' | 'high-accuracy' | 'balanced' | 'low-power';

const NOTIFICATION = {
  notificationTitle: 'EB Background Location',
  notificationText: 'Demo tracking is running',
} as const;

const CONFIG_PRESETS: Record<ConfigPreset, TrackingOptions> = {
  'default': {
    intervalMs: 5_000,
    fastestIntervalMs: 3_000,
    distanceFilterM: 10,
    accuracy: 'high',
    ...NOTIFICATION,
  },
  'high-accuracy': {
    intervalMs: 2_000,
    fastestIntervalMs: 1_000,
    distanceFilterM: 5,
    accuracy: 'high',
    ...NOTIFICATION,
  },
  'balanced': {
    intervalMs: 10_000,
    fastestIntervalMs: 5_000,
    distanceFilterM: 25,
    accuracy: 'balanced',
    ...NOTIFICATION,
  },
  'low-power': {
    intervalMs: 30_000,
    fastestIntervalMs: 15_000,
    distanceFilterM: 50,
    accuracy: 'low',
    ...NOTIFICATION,
  },
};

const PRESET_LABELS: { id: ConfigPreset; label: string }[] = [
  { id: 'default', label: 'Default' },
  { id: 'high-accuracy', label: 'High Accuracy' },
  { id: 'balanced', label: 'Balanced' },
  { id: 'low-power', label: 'Low Power' },
];

const AVAILABLE_CLEAR_DELAY_MS = 3000;

function formatLocationProperties(
  point: LocationPoint
): Record<string, string> {
  const properties: Record<string, string> = {};
  if (point.accuracy != null) {
    properties.Accuracy = `${point.accuracy.toFixed(2)} m`;
  }
  if (point.altitude != null) {
    properties.Altitude = `${point.altitude.toFixed(2)} m`;
  }
  if (point.speed != null) {
    const speedKmh = (point.speed * 3.6).toFixed(2);
    properties.Speed = `${speedKmh} km/h (${point.speed.toFixed(2)} m/s)`;
  }
  if (point.heading != null) {
    properties.Heading = `${point.heading.toFixed(2)}°`;
  }
  return properties;
}

export default function App() {
  const availableClearTimerRef = useRef<ReturnType<typeof setTimeout> | null>(
    null
  );
  const [permission, setPermission] =
    useState<PermissionStatus>('undetermined');
  const [canRequestAgain, setCanRequestAgain] = useState(true);
  const [isRequesting, setIsRequesting] = useState(false);
  const [active, setActive] = useState(false);
  const [busy, setBusy] = useState(false);
  const [sessionId, setSessionId] = useState<string | undefined>();
  const [points, setPoints] = useState<LocationPoint[]>([]);
  const [alert, setAlert] = useState<string | null>(null);
  const [showConfig, setShowConfig] = useState(false);
  const [configPreset, setConfigPreset] = useState<ConfigPreset>('default');
  const [trackingOptions, setTrackingOptions] = useState<TrackingOptions>(
    CONFIG_PRESETS.default
  );

  const applyPreset = (preset: ConfigPreset) => {
    setConfigPreset(preset);
    setTrackingOptions(CONFIG_PRESETS[preset]);
  };

  const refreshStatus = useCallback(async () => {
    console.log('[EBBgLoc]', '[UI] isTracking() called');
    const result = await isTracking();
    console.log('[EBBgLoc]', '[UI] isTracking() result', result);
    setActive(result.active);
    setSessionId(result.sessionId);
    return result;
  }, []);

  const refreshPermission = useCallback(async () => {
    const result = await getLocationPermissionStatus();
    setPermission(result.status);
    setCanRequestAgain(result.canRequestAgain);
    return result;
  }, []);

  const loadPersistedPoints = useCallback(async (sid?: string) => {
    if (!sid) return;
    try {
      const stored = await getSessionLocations(sid, 30);
      if (stored.length > 0) {
        setPoints(stored);
      }
    } catch (error) {
      console.log('[EBBgLoc]', '[UI] loadPersistedPoints FAILED', error);
    }
  }, []);

  const clearAvailableClearTimer = useCallback(() => {
    if (availableClearTimerRef.current) {
      clearTimeout(availableClearTimerRef.current);
      availableClearTimerRef.current = null;
    }
  }, []);

  useEffect(() => {
    console.log(
      '[EBBgLoc]',
      '[UI] mount — attaching listeners + refreshStatus'
    );
    void refreshPermission();
    void refreshStatus().then((result) => {
      if (result.sessionId) {
        void loadPersistedPoints(result.sessionId);
      }
    });

    const removeLocation = addLocationListener((point) => {
      console.log('[EBBgLoc]', '[UI] location event', {
        sessionId: point.sessionId,
        lat: point.latitude,
        lng: point.longitude,
        accuracy: point.accuracy,
        speed: point.speed,
        heading: point.heading,
        altitude: point.altitude,
        timestamp: point.timestamp,
      });
      setPoints((prev) => [point, ...prev].slice(0, 30));
    });
    const removeError = addErrorListener((event) => {
      console.log('[EBBgLoc]', '[UI] error event', event);
      setAlert(`error ${event.code}: ${event.message}`);
    });
    const removeWarning = addWarningListener((event) => {
      console.log('[EBBgLoc]', '[UI] warning event', event);
      if (event.code === 'LOCATION_UNAVAILABLE') {
        clearAvailableClearTimer();
        setAlert(`warn ${event.code}: ${event.message}`);
        return;
      }
      if (event.code === 'LOCATION_AVAILABLE') {
        clearAvailableClearTimer();
        availableClearTimerRef.current = setTimeout(() => {
          setAlert(null);
          availableClearTimerRef.current = null;
        }, AVAILABLE_CLEAR_DELAY_MS);
        return;
      }
      setAlert(`warn ${event.code}: ${event.message}`);
    });

    const appStateSub = AppState.addEventListener('change', (state) => {
      if (state !== 'active') return;
      void refreshPermission();
      void refreshStatus().then((result) => {
        if (result.sessionId) {
          void loadPersistedPoints(result.sessionId);
        }
      });
    });

    return () => {
      console.log('[EBBgLoc]', '[UI] unmount — removing listeners');
      clearAvailableClearTimer();
      removeLocation();
      removeError();
      removeWarning();
      appStateSub.remove();
    };
  }, [
    clearAvailableClearTimer,
    loadPersistedPoints,
    refreshPermission,
    refreshStatus,
  ]);

  const onRequestPermissions = async () => {
    try {
      console.log('[EBBgLoc]', '[UI] tap Permissions');
      setIsRequesting(true);
      console.log('[EBBgLoc]', '[UI] requestNotificationPermission()');
      const notification = await requestNotificationPermission();
      console.log('[EBBgLoc]', '[UI] notification permission =', notification);
      console.log(
        '[EBBgLoc]',
        '[UI] requestLocationPermission(false) — Always/background'
      );
      const location = await requestLocationPermission(false);
      console.log('[EBBgLoc]', '[UI] location permission =', location);
      setPermission(location.status);
      setCanRequestAgain(location.canRequestAgain);
    } catch (error) {
      console.log('[EBBgLoc]', '[UI] permission FAILED', error);
      const message = error instanceof Error ? error.message : String(error);
      setAlert(message);
    } finally {
      setIsRequesting(false);
    }
  };

  const onStart = async () => {
    try {
      const id = `demo-${Date.now()}`;
      console.log('[EBBgLoc]', '[UI] tap Start', {
        sessionId: id,
        trackingOptions,
      });
      setBusy(true);
      await startTracking(id, trackingOptions);
      console.log('[EBBgLoc]', '[UI] startTracking SUCCESS', id);
      const status = await refreshStatus();
      if (status.sessionId) {
        await loadPersistedPoints(status.sessionId);
      }
    } catch (error) {
      console.log('[EBBgLoc]', '[UI] startTracking FAILED', error);
      const message = error instanceof Error ? error.message : String(error);
      if (message.includes('BACKGROUND_PERMISSION_REQUIRED')) {
        setAlert(
          'Background permission required. Grant "Allow all the time" in Settings.'
        );
      } else {
        setAlert(`Start failed: ${message}`);
      }
    } finally {
      setBusy(false);
    }
  };

  const onStop = async () => {
    try {
      console.log('[EBBgLoc]', '[UI] tap Stop');
      setBusy(true);
      await stopTracking();
      console.log('[EBBgLoc]', '[UI] stopTracking SUCCESS');
      await refreshStatus();
    } catch (error) {
      console.log('[EBBgLoc]', '[UI] stopTracking FAILED', error);
      const message = error instanceof Error ? error.message : String(error);
      setAlert(`Stop failed: ${message}`);
    } finally {
      setBusy(false);
    }
  };

  if (permission === 'blocked') {
    return (
      <SafeAreaView style={styles.centeredContainer}>
        <View style={styles.gateContent}>
          <Text style={styles.title}>Permissions Blocked</Text>
          <Text style={styles.description}>
            Location permissions are permanently denied. Please enable them in
            your device settings.
          </Text>
          <Pressable
            style={[styles.actionButton, styles.mutedButton]}
            onPress={() => Linking.openSettings()}
          >
            <Text style={styles.buttonText}>Open Settings</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  if (permission !== 'granted' && permission !== 'whenInUse') {
    return (
      <SafeAreaView style={styles.centeredContainer}>
        <View style={styles.gateContent}>
          <Text style={styles.title}>Location Permissions Required</Text>
          <Text style={styles.description}>
            This app needs access to your location (including in the background)
            to track your trips.
          </Text>
          {isRequesting ? (
            <ActivityIndicator size="large" color="#1B6EF3" />
          ) : (
            <Pressable
              style={[styles.actionButton, styles.primaryButton]}
              onPress={
                canRequestAgain
                  ? onRequestPermissions
                  : () => Linking.openSettings()
              }
            >
              <Text style={styles.buttonText}>
                {canRequestAgain ? 'Grant Permissions' : 'Open Settings'}
              </Text>
            </Pressable>
          )}
        </View>
      </SafeAreaView>
    );
  }

  const lastLocation = points[0];
  const lastLocationProps = lastLocation
    ? formatLocationProperties(lastLocation)
    : {};

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.content}
      >
        <Text style={styles.title}>Background Location Example</Text>
        <Text style={styles.subtitle}>
          Library example harness ({Platform.OS})
        </Text>

        <View style={styles.configContainer}>
          <View style={styles.configHeader}>
            <Text style={styles.configTitle}>Tracking Configuration</Text>
            <Pressable
              style={styles.toggleButton}
              onPress={() => setShowConfig((prev) => !prev)}
            >
              <Text style={styles.toggleButtonText}>
                {showConfig ? 'Hide' : 'Show'}
              </Text>
            </Pressable>
          </View>

          {showConfig && (
            <View style={styles.configContent}>
              <Text style={styles.configSectionTitle}>Presets:</Text>
              <View style={styles.presetContainer}>
                {PRESET_LABELS.map(({ id, label }) => {
                  const selected = configPreset === id;
                  return (
                    <Pressable
                      key={id}
                      style={[
                        styles.presetButton,
                        selected && styles.presetButtonSelected,
                      ]}
                      onPress={() => applyPreset(id)}
                    >
                      <Text
                        style={[
                          styles.presetButtonText,
                          selected && styles.presetButtonTextSelected,
                        ]}
                      >
                        {label}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>

              <View style={styles.configDetails}>
                <Text style={styles.configDetailTitle}>
                  Current Configuration:
                </Text>
                <Text style={styles.configDetailText}>
                  Update Interval: {trackingOptions.intervalMs}ms
                </Text>
                <Text style={styles.configDetailText}>
                  Fastest Interval: {trackingOptions.fastestIntervalMs}ms
                </Text>
                <Text style={styles.configDetailText}>
                  Distance Filter: {trackingOptions.distanceFilterM}m
                </Text>
                <Text style={styles.configDetailText}>
                  Accuracy: {trackingOptions.accuracy}
                </Text>
                <Text style={styles.configDetailText}>
                  Notification Title: {trackingOptions.notificationTitle}
                </Text>
                <Text style={styles.configDetailText}>
                  Notification Text: {trackingOptions.notificationText}
                </Text>
              </View>

              <View style={styles.configInfo}>
                <Text style={styles.configInfoText}>
                  These options will be applied when you start tracking. The
                  configuration affects battery consumption and location
                  accuracy.
                </Text>
              </View>
            </View>
          )}
        </View>

        <View style={styles.infoContainer}>
          <Text style={styles.infoText}>
            Locations update automatically in real-time
          </Text>
        </View>

        <View style={styles.statusContainer}>
          <Text style={styles.statusLabel}>Status:</Text>
          <Text
            style={[
              styles.statusText,
              active ? styles.tracking : styles.stopped,
            ]}
          >
            {active ? 'TRACKING' : 'STOPPED'}
          </Text>
        </View>

        {sessionId ? (
          <View style={styles.sessionContainer}>
            <Text style={styles.label}>Current Session ID:</Text>
            <Text style={styles.sessionId}>{sessionId}</Text>
          </View>
        ) : null}

        {lastLocation ? (
          <View style={styles.lastLocationContainer}>
            <Text style={styles.label}>Last Location (Live):</Text>
            <Text style={styles.locationDetail}>
              Lat: {lastLocation.latitude}
            </Text>
            <Text style={styles.locationDetail}>
              Lng: {lastLocation.longitude}
            </Text>
            <Text style={styles.timestampText}>
              {new Date(lastLocation.timestamp).toLocaleString()}
            </Text>
            {Object.entries(lastLocationProps).map(([key, value]) => (
              <Text key={key} style={styles.locationDetail}>
                {key}: {value}
              </Text>
            ))}
          </View>
        ) : null}

        {alert ? (
          <View style={styles.errorContainer}>
            <Text style={styles.errorText}>{alert}</Text>
            <Pressable
              style={styles.dismissButton}
              onPress={() => setAlert(null)}
            >
              <Text style={styles.buttonText}>Dismiss</Text>
            </Pressable>
          </View>
        ) : null}

        <View style={styles.buttonContainer}>
          {busy ? (
            <ActivityIndicator size="large" color="#1B6EF3" />
          ) : active ? (
            <Pressable
              style={[styles.actionButton, styles.dangerButton]}
              onPress={onStop}
            >
              <Text style={styles.buttonText}>Stop Tracking</Text>
            </Pressable>
          ) : (
            <Pressable
              style={[styles.actionButton, styles.primaryButton]}
              onPress={onStart}
            >
              <Text style={styles.buttonText}>Start Tracking</Text>
            </Pressable>
          )}
        </View>

        <View style={styles.locationsContainer}>
          <Text style={styles.sectionTitle}>Locations ({points.length}):</Text>
          {points.length === 0 ? (
            <Text style={styles.emptyText}>
              {active
                ? 'Waiting for location updates...'
                : 'No locations yet. Start tracking to collect locations.'}
            </Text>
          ) : (
            points.map((point, index) => {
              const extra = formatLocationProperties(point);
              return (
                <View
                  key={`${point.timestamp}-${point.latitude}-${index}`}
                  style={styles.locationItem}
                >
                  <Text style={styles.locationText}>
                    #{index + 1} - Lat: {point.latitude}, Lng: {point.longitude}
                  </Text>
                  <Text style={styles.timestampText}>
                    {new Date(point.timestamp).toLocaleString()}
                  </Text>
                  {Object.keys(extra).length > 0 ? (
                    <View style={styles.additionalPropsContainer}>
                      {Object.entries(extra).map(([key, value]) => (
                        <Text key={key} style={styles.additionalPropText}>
                          {key}: {value}
                        </Text>
                      ))}
                    </View>
                  ) : null}
                </View>
              );
            })
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
