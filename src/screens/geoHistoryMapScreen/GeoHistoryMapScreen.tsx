import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StatusBar,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import WebView, {
  type WebView as WebViewType,
  type WebViewMessageEvent,
  type WebViewProps,
} from 'react-native-webview';
import { AUTH_ERRORS, getAuthErrorMessage } from '../../constants/ApiEndpoints';
import { ScreenNames } from '../../constants/ScreenNames';
import { RootStackParamList } from '../../navigation/AppNavigator';
import {
  fetchFieldMapConfig,
  fetchFieldSessionRoute,
  isRequestCanceled,
  type FieldHistoryTrailPoint,
  type FieldSessionRouteResult,
} from '../../services/apiClient';
import { useAppSelector } from '../../store/hooks';
import { useAppTheme } from '../../theme/ThemeContext';
import { useResponsive } from '../../hooks/useResponsive';
import { createStyles } from './GeoHistoryMapScreenStyle';

type Props = NativeStackScreenProps<
  RootStackParamList,
  typeof ScreenNames.GEO_HISTORY_MAP
>;

/** RN 0.86 / React 19 typings mark WebView props as `never`; cast for usable JSX. */
const MapWebView = WebView as unknown as React.ComponentType<
  WebViewProps & { ref?: React.Ref<WebViewType> }
>;

const TASK_TRAIL_COLOR = '#F59E0B';

function escapeJsString(value: string): string {
  return value
    .replace(/\\/g, '\\\\')
    .replace(/'/g, "\\'")
    .replace(/\n/g, '\\n')
    .replace(/\r/g, '\\r');
}

function filterRouteForTask(
  route: FieldSessionRouteResult,
  taskId: number,
): FieldSessionRouteResult | null {
  if (route.trail_source !== 'points' || !Array.isArray(route.trail)) {
    return null;
  }

  const trail = (route.trail as FieldHistoryTrailPoint[]).filter((row) => {
    if (!Array.isArray(row) || row.length < 4) {
      return false;
    }
    return Number(row[3]) === taskId;
  });

  if (trail.length < 2) {
    return null;
  }

  return {
    ...route,
    trail_source: 'points',
    trail,
    stops: route.stops.filter((stop) => Number(stop.task_id) === taskId),
    tasks: route.tasks.filter((task) => task.task_id === taskId),
  };
}

function buildHistoryMapsHtml(apiKey: string): string {
  const key = escapeJsString(apiKey);
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no" />
  <style>
    html, body, #map { margin: 0; padding: 0; height: 100%; width: 100%; }
    .gm-fullscreen-control { display: none !important; }
  </style>
</head>
<body>
  <div id="map"></div>
  <script>
    var map = null;
    var trailLines = [];
    var stopMarkers = [];
    var pendingPayload = null;
    var TASK_COLOR = '${TASK_TRAIL_COLOR}';

    function post(type, payload) {
      try {
        window.ReactNativeWebView && window.ReactNativeWebView.postMessage(
          JSON.stringify(Object.assign({ type: type }, payload || {}))
        );
      } catch (e) {}
    }

    function clearOverlays() {
      trailLines.forEach(function(line) { line.setMap(null); });
      trailLines = [];
      stopMarkers.forEach(function(marker) { marker.setMap(null); });
      stopMarkers = [];
    }

    function extendBounds(bounds, lat, lng) {
      bounds.extend({ lat: Number(lat), lng: Number(lng) });
    }

    function drawStops(stops, bounds) {
      if (!Array.isArray(stops)) {
        return;
      }
      stops.forEach(function(stop) {
        if (stop == null || stop.latitude == null || stop.longitude == null) {
          return;
        }
        var position = {
          lat: Number(stop.latitude),
          lng: Number(stop.longitude),
        };
        var title = stop.name ? String(stop.name) : 'Stop';
        stopMarkers.push(new google.maps.Marker({
          position: position,
          map: map,
          title: title,
        }));
        extendBounds(bounds, position.lat, position.lng);
      });
    }

    function drawPointsTrail(points, bounds) {
      if (!Array.isArray(points) || points.length < 2) {
        return;
      }
      var segment = [];

      function flushSegment() {
        if (segment.length < 2) {
          segment = [];
          return;
        }
        var line = new google.maps.Polyline({
          path: segment,
          geodesic: true,
          strokeColor: TASK_COLOR,
          strokeOpacity: 0.9,
          strokeWeight: 5,
          map: map,
        });
        trailLines.push(line);
        segment = [];
      }

      points.forEach(function(row) {
        if (!Array.isArray(row) || row.length < 2) {
          return;
        }
        var lat = Number(row[0]);
        var lng = Number(row[1]);
        if (!isFinite(lat) || !isFinite(lng)) {
          return;
        }
        var point = { lat: lat, lng: lng };
        extendBounds(bounds, lat, lng);
        segment.push(point);
      });
      flushSegment();
    }

    function drawEncodedPolyline(encoded, bounds) {
      if (!encoded || typeof encoded !== 'string') {
        return;
      }
      if (!google.maps.geometry || !google.maps.geometry.encoding) {
        post('route_error', { message: 'geometry_missing' });
        return;
      }
      var path = google.maps.geometry.encoding.decodePath(encoded);
      if (!path || path.length < 2) {
        return;
      }
      path.forEach(function(p) {
        extendBounds(bounds, p.lat(), p.lng());
      });
      trailLines.push(new google.maps.Polyline({
        path: path,
        geodesic: true,
        strokeColor: TASK_COLOR,
        strokeOpacity: 0.9,
        strokeWeight: 5,
        map: map,
      }));
    }

    function applyPayload(payload) {
      if (!map || !payload) {
        return;
      }
      try {
        clearOverlays();
        var bounds = new google.maps.LatLngBounds();
        var source = payload.trail_source;
        if (source === 'points') {
          drawPointsTrail(payload.trail, bounds);
        } else if (source === 'polyline') {
          drawEncodedPolyline(payload.trail, bounds);
        }
        drawStops(payload.stops, bounds);
        if (!bounds.isEmpty()) {
          map.fitBounds(bounds, 48);
        }
        post('route_drawn', { trail_source: source });
      } catch (e) {
        post('route_error', { message: String(e && e.message ? e.message : e) });
      }
    }

    function initMap() {
      try {
        map = new google.maps.Map(document.getElementById('map'), {
          center: { lat: 20.5937, lng: 78.9629 },
          zoom: 5,
          mapTypeControl: false,
          streetViewControl: false,
          fullscreenControl: false,
          zoomControl: false,
          keyboardShortcuts: false,
        });
        post('map_ready');
        if (pendingPayload) {
          applyPayload(pendingPayload);
          pendingPayload = null;
        }
      } catch (e) {
        post('map_error', { message: String(e && e.message ? e.message : e) });
      }
    }

    window.drawHistoryTrail = function(payload) {
      if (!map) {
        pendingPayload = payload;
        return;
      }
      applyPayload(payload);
    };

    window.onGoogleMapsFailed = function() {
      post('map_error', { message: 'script_load_failed' });
    };
  </script>
  <script
    src="https://maps.googleapis.com/maps/api/js?key=${key}&libraries=geometry&callback=initMap"
    async
    defer
    onerror="window.onGoogleMapsFailed && window.onGoogleMapsFailed()"
  ></script>
</body>
</html>`;
}

const GeoHistoryMapScreen = ({ navigation, route }: Props) => {
  const { colors, isDark } = useAppTheme();
  const { isTablet, contentMaxWidth } = useResponsive();
  const styles = createStyles(colors, isTablet, contentMaxWidth);
  const accessToken = useAppSelector((state) => state.auth.accessToken);
  const { sessionId, taskId, taskName } = route.params;

  const webViewRef = useRef<WebViewType>(null);
  const mapReadyRef = useRef(false);
  const pendingDrawRef = useRef<FieldSessionRouteResult | null>(null);

  const [mapHtml, setMapHtml] = useState<string | null>(null);
  const [routeData, setRouteData] = useState<FieldSessionRouteResult | null>(
    null,
  );
  const [trailUnavailable, setTrailUnavailable] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const headerTitle = useMemo(() => {
    if (typeof taskName === 'string' && taskName.trim()) {
      return taskName.trim();
    }
    return 'Route';
  }, [taskName]);

  const iconSize = isTablet ? 26 : 22;

  const injectTrail = useCallback((payload: FieldSessionRouteResult) => {
    if (!webViewRef.current) {
      pendingDrawRef.current = payload;
      return;
    }
    if (!mapReadyRef.current) {
      pendingDrawRef.current = payload;
      return;
    }
    const json = JSON.stringify({
      trail_source: payload.trail_source,
      trail: payload.trail,
      stops: payload.stops.map((stop) => ({
        stop_id: stop.stop_id,
        latitude: stop.latitude,
        longitude: stop.longitude,
        name: stop.name === false ? null : stop.name,
      })),
    });
    webViewRef.current.injectJavaScript(
      `window.drawHistoryTrail && window.drawHistoryTrail(${json}); true;`,
    );
  }, []);

  useEffect(() => {
    if (!accessToken) {
      setError('Session expired. Please log in again.');
      setLoading(false);
      return;
    }

    const controller = new AbortController();
    mapReadyRef.current = false;
    pendingDrawRef.current = null;
    setLoading(true);
    setError(null);
    setMapHtml(null);
    setRouteData(null);
    setTrailUnavailable(false);

    (async () => {
      try {
        const config = await fetchFieldMapConfig(accessToken, {
          signal: controller.signal,
        });
        if (controller.signal.aborted) {
          return;
        }
        if (!config.maps_configured || !config.google_maps_api_key) {
          setError(getAuthErrorMessage(AUTH_ERRORS.MAPS_NOT_CONFIGURED));
          setLoading(false);
          return;
        }

        const result = await fetchFieldSessionRoute(
          accessToken,
          sessionId,
          { max_points: 300 },
          { signal: controller.signal },
        );
        if (controller.signal.aborted) {
          return;
        }

        const filtered = filterRouteForTask(result, taskId);
        if (!filtered) {
          setTrailUnavailable(true);
          setRouteData(null);
          setLoading(false);
          return;
        }

        setRouteData(filtered);
        setMapHtml(buildHistoryMapsHtml(config.google_maps_api_key));
        pendingDrawRef.current = filtered;
        setLoading(false);
      } catch (e) {
        if (controller.signal.aborted || isRequestCanceled(e)) {
          return;
        }
        const message =
          e instanceof Error ? e.message : AUTH_ERRORS.SESSION_ROUTE_FAILED;
        setError(getAuthErrorMessage(message));
        setLoading(false);
      }
    })();

    return () => {
      controller.abort();
    };
  }, [accessToken, sessionId, taskId]);

  const handleWebViewMessage = useCallback(
    (event: WebViewMessageEvent) => {
      try {
        const data = JSON.parse(event.nativeEvent.data) as {
          type?: string;
          message?: string;
        };
        if (data.type === 'map_ready') {
          mapReadyRef.current = true;
          if (pendingDrawRef.current) {
            injectTrail(pendingDrawRef.current);
            pendingDrawRef.current = null;
          }
          return;
        }
        if (data.type === 'map_error' || data.type === 'route_error') {
          setError(
            getAuthErrorMessage(
              data.message || AUTH_ERRORS.SESSION_ROUTE_FAILED,
            ),
          );
        }
      } catch {
        // ignore malformed webview messages
      }
    },
    [injectTrail],
  );

  return (
    <SafeAreaView
      style={styles.container}
      edges={['top', 'left', 'right', 'bottom']}
    >
      <StatusBar
        barStyle={isDark ? 'light-content' : 'dark-content'}
        backgroundColor={colors.background}
      />

      <View style={styles.header}>
        <Pressable
          style={styles.headerButton}
          onPress={() => navigation.goBack()}
          accessibilityRole="button"
          accessibilityLabel="Back"
        >
          <MaterialIcons
            name="arrow-back"
            size={iconSize}
            color={colors.textEnabled}
          />
        </Pressable>

        <Text style={styles.headerTitle} numberOfLines={1}>
          {headerTitle}
        </Text>

        <View style={styles.headerSpacer} />
      </View>

      {loading ? (
        <View style={styles.centerMessage}>
          <ActivityIndicator size="large" color={colors.textEnabled} />
        </View>
      ) : error ? (
        <View style={styles.centerMessage}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : trailUnavailable || !routeData ? (
        <View style={styles.centerMessage}>
          <Text style={styles.messageText}>Task trail not available</Text>
        </View>
      ) : (
        <View style={styles.mapWrap}>
          {mapHtml ? (
            <MapWebView
              ref={webViewRef}
              style={styles.map}
              originWhitelist={['*']}
              source={{ html: mapHtml, baseUrl: 'https://maps.googleapis.com' }}
              onMessage={handleWebViewMessage}
              javaScriptEnabled
              domStorageEnabled
              mixedContentMode="always"
              setSupportMultipleWindows={false}
            />
          ) : null}
        </View>
      )}
    </SafeAreaView>
  );
};

export default GeoHistoryMapScreen;
