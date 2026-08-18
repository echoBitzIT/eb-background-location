import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  Modal,
  Pressable,
  ScrollView,
  StatusBar,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useFocusEffect } from '@react-navigation/native';
import Geolocation from 'react-native-geolocation-service';
import LinearGradient from 'react-native-linear-gradient';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import WebView, {
  type WebView as WebViewType,
  type WebViewMessageEvent,
  type WebViewProps,
} from 'react-native-webview';
import { AUTH_ERRORS, getAuthErrorMessage } from '../../constants/ApiEndpoints';
import { ScreenNames } from '../../constants/ScreenNames';
import { RootStackParamList } from '../../navigation/AppNavigator';
import { popToScreen } from '../../navigation/popToScreen';
import { showAlert } from '../../components/common/customAlert/alertService';
import {
  arriveFieldTask,
  cancelFieldTask,
  fetchFieldDirections,
  fetchFieldMapConfig,
  fetchFieldTaskDetail,
  isRequestCanceled,
  pauseFieldTask,
  startFieldTask,
  type FieldAltRoute,
  type FieldAvoidOption,
  type FieldLatLng,
  type FieldTaskCancelReason,
  type FieldTaskPauseReason,
  type FieldTaskRequirements,
} from '../../services/apiClient';
import { startLocationTracking } from '../../services/locationTrackingService';
import {
  clearTaskProgress,
  formatOdooDeviceTimestamp,
  loadTaskProgress,
  saveTaskProgress,
} from '../../services/taskProgressStorage';
import { useAppSelector } from '../../store/hooks';
import { useAppTheme } from '../../theme/ThemeContext';
import { useResponsive } from '../../hooks/useResponsive';
import { getCurrentCoordinates } from '../../utils/locationGate';
import { createPointUuid } from '../../utils/pointUuid';
import {
  formatPauseReasonLine,
  isTaskStartBlocked,
  syncTrackingAfterTaskTerminal,
} from '../../utils/fieldTaskUi';
import { createStyles } from './TaskMapScreenStyle';
import { buildGoogleMapsHtml } from './taskMapHtml';
import {
  OFF_ROUTE_HITS_NEEDED,
  OFF_ROUTE_THRESHOLD_M,
  type MapTypeId,
  type TravelMode,
  distanceMeters,
  formatDistanceKm,
  formatEta,
  formatLastKnownAge,
  formatRouteSummary,
  loadLastKnownFix,
  minDistanceToPolylineMeters,
  openExternalMaps,
  saveLastKnownFix,
} from './taskMapUtils';

type Props = NativeStackScreenProps<
  RootStackParamList,
  typeof ScreenNames.TASK_MAP
>;

type UserFix = FieldLatLng & { heading?: number | null };

type BannerTone = 'error' | 'warning' | 'info';

/** RN 0.86 / React 19 typings mark WebView props as `never`; cast for usable JSX. */
const MapWebView = WebView as unknown as React.ComponentType<
  WebViewProps & { ref?: React.Ref<WebViewType> }
>;

function isTaskStartedStatus(status?: string, state?: string): boolean {
  if (status === 'active') {
    return true;
  }
  return state === 'in_progress' || state === 'arrived';
}

/** Re-fetch directions only after meaningful movement (meters). */
const REROUTE_MIN_DISTANCE_M = 20;
/** Minimum gap between Directions API calls (ms). */
const REROUTE_MIN_INTERVAL_MS = 10_000;

const MAP_TYPES: { id: MapTypeId; label: string }[] = [
  { id: 'roadmap', label: 'Map' },
  { id: 'hybrid', label: 'Satellite' },
  { id: 'terrain', label: 'Terrain' },
];

const TRAVEL_MODES: { id: TravelMode; label: string }[] = [
  { id: 'driving', label: 'Drive' },
  { id: 'walking', label: 'Walk' },
];

type FabMenuId = 'map' | 'route';

const themeIconName = (night: boolean) =>
  night ? 'light-mode' : 'dark-mode';

function getTaskMapErrorTitle(code: string): string {
  switch (code) {
    case AUTH_ERRORS.GPS_REQUIRED:
      return 'GPS required';
    case AUTH_ERRORS.TASK_INVALID_STATE:
      return 'Task not ready';
    case AUTH_ERRORS.MAPS_NOT_CONFIGURED:
      return 'Maps not configured';
    case AUTH_ERRORS.DIRECTIONS_FAILED:
      return 'Route unavailable';
    case AUTH_ERRORS.UNAUTHORIZED:
      return 'Session expired';
    case AUTH_ERRORS.TASK_START_FAILED:
      return 'Could not start task';
    case AUTH_ERRORS.TASK_ARRIVE_FAILED:
      return 'Could not mark arrival';
    case AUTH_ERRORS.LOCATION_UNAVAILABLE:
      return 'Location required';
    default:
      return 'Something went wrong';
  }
}

function showMapError(
  codeOrMessage: string,
  options?: {
    title?: string;
    confirmText?: string;
    cancelText?: string;
    onConfirm?: () => void;
    onCancel?: () => void;
  },
): void {
  showAlert({
    title: options?.title ?? getTaskMapErrorTitle(codeOrMessage),
    message: getAuthErrorMessage(codeOrMessage),
    confirmText: options?.confirmText ?? 'OK',
    cancelText: options?.cancelText,
    onConfirm: options?.onConfirm,
    onCancel: options?.onCancel,
  });
}

const TaskMapScreen = ({ navigation, route }: Props) => {
  const {
    taskId,
    title,
    address,
    latitude,
    longitude,
    distanceKm,
    status,
    isUpcoming: isUpcomingParam,
  } = route.params;
  const { colors, isDark } = useAppTheme();
  const { isTablet, contentMaxWidth } = useResponsive();
  const styles = createStyles(colors, isTablet, contentMaxWidth);
  const accessToken = useAppSelector((state) => state.auth.accessToken);
  const accessTokenRef = useRef(accessToken);
  const webViewRef = useRef<WebViewType>(null);
  const mapReadyRef = useRef(false);
  const pendingRouteRef = useRef<FieldLatLng[] | null>(null);
  const pendingAltsRef = useRef<{
    routes: FieldAltRoute[];
    selectedIndex: number;
  } | null>(null);
  const pendingUserRef = useRef<UserFix | null>(null);
  const pendingFitRef = useRef(true);
  const watchIdRef = useRef<number | null>(null);
  const lastRouteOriginRef = useRef<FieldLatLng | null>(null);
  const lastRouteAtRef = useRef<number | null>(null);
  const routeRefreshInFlightRef = useRef(false);
  const arrivingRef = useRef(false);
  const taskArrivedRef = useRef(false);
  const lastUserRef = useRef<UserFix | null>(null);
  const lastHeadingRef = useRef<number>(0);
  const followMeRef = useRef(true);
  const routeCoordsRef = useRef<FieldLatLng[]>([]);
  const offRouteHitsRef = useRef(0);
  const offRouteRef = useRef(false);
  const initialDistanceMRef = useRef<number | null>(null);
  const routeFittedRef = useRef(false);
  const travelModeRef = useRef<TravelMode>('driving');
  const avoidRef = useRef<FieldAvoidOption[]>([]);
  const arrivalRadiusRef = useRef<number | null>(null);
  const mapTypeRef = useRef<MapTypeId>('roadmap');
  const nightMapRef = useRef(isDark);
  const altRoutesRef = useRef<FieldAltRoute[]>([]);

  useEffect(() => {
    accessTokenRef.current = accessToken;
  }, [accessToken]);

  const [reloadKey, setReloadKey] = useState(0);
  const [loading, setLoading] = useState(true);
  const [banner, setBanner] = useState<string | null>(null);
  const [bannerTone, setBannerTone] = useState<BannerTone>('error');
  const [mapHtml, setMapHtml] = useState<string | null>(null);
  const [startingTask, setStartingTask] = useState(false);
  const [taskStatus, setTaskStatus] = useState(status);
  const [isUpcoming, setIsUpcoming] = useState(() =>
    Boolean(isUpcomingParam),
  );
  const [pauseReasonLine, setPauseReasonLine] = useState<string | null>(null);
  const [taskStarted, setTaskStarted] = useState(() =>
    isTaskStartedStatus(status),
  );
  const [taskArrived, setTaskArrived] = useState(false);
  const [stopId, setStopId] = useState<number | null>(null);
  const [requirements, setRequirements] =
    useState<FieldTaskRequirements | null>(null);
  const [cancelReasons, setCancelReasons] = useState<FieldTaskCancelReason[]>(
    [],
  );
  const [pauseReasons, setPauseReasons] = useState<FieldTaskPauseReason[]>([]);
  const [arriving, setArriving] = useState(false);
  const [cancelVisible, setCancelVisible] = useState(false);
  const [cancelReason, setCancelReason] = useState<string | null>(null);
  const [cancelNote, setCancelNote] = useState('');
  const [cancelling, setCancelling] = useState(false);
  const [pauseVisible, setPauseVisible] = useState(false);
  const [pauseReason, setPauseReason] = useState<string | null>(null);
  const [pauseNote, setPauseNote] = useState('');
  const [pausing, setPausing] = useState(false);
  const [cardExpanded, setCardExpanded] = useState(true);
  const [liveDistanceKm, setLiveDistanceKm] = useState<number | null>(() =>
    typeof distanceKm === 'number' && Number.isFinite(distanceKm)
      ? distanceKm
      : null,
  );
  const [liveEtaSeconds, setLiveEtaSeconds] = useState<number | null>(null);
  const [mapType, setMapType] = useState<MapTypeId>('roadmap');
  const [followMe, setFollowMe] = useState(true);
  const [nightMap, setNightMap] = useState(isDark);
  const [travelMode, setTravelMode] = useState<TravelMode>('driving');
  const [openMenu, setOpenMenu] = useState<FabMenuId | null>(null);
  const [offRoute, setOffRoute] = useState(false);
  const [altRoutes, setAltRoutes] = useState<FieldAltRoute[]>([]);
  const [selectedRoute, setSelectedRoute] = useState(0);
  const [arrivalRadiusM, setArrivalRadiusM] = useState<number | null>(null);
  const [routeProgress, setRouteProgress] = useState<number | null>(null);

  useEffect(() => {
    if (taskStarted) {
      setCardExpanded(true);
    }
  }, [taskStarted]);

  useEffect(() => {
    arrivingRef.current = arriving;
  }, [arriving]);

  useEffect(() => {
    taskArrivedRef.current = taskArrived;
  }, [taskArrived]);

  useEffect(() => {
    followMeRef.current = followMe;
  }, [followMe]);

  useEffect(() => {
    offRouteRef.current = offRoute;
  }, [offRoute]);

  useEffect(() => {
    travelModeRef.current = travelMode;
  }, [travelMode]);

  useEffect(() => {
    arrivalRadiusRef.current = arrivalRadiusM;
  }, [arrivalRadiusM]);

  useEffect(() => {
    mapTypeRef.current = mapType;
  }, [mapType]);

  useEffect(() => {
    nightMapRef.current = nightMap;
  }, [nightMap]);

  const themeIconAnim = useRef(new Animated.Value(1)).current;
  const themeIconMountedRef = useRef(false);
  const [themeIcon, setThemeIcon] = useState(() => themeIconName(nightMap));

  useEffect(() => {
    const nextIcon = themeIconName(nightMap);
    if (!themeIconMountedRef.current) {
      themeIconMountedRef.current = true;
      setThemeIcon(nextIcon);
      return;
    }
    const fadeOut = Animated.timing(themeIconAnim, {
      toValue: 0,
      duration: 150,
      useNativeDriver: true,
    });
    const fadeIn = Animated.timing(themeIconAnim, {
      toValue: 1,
      duration: 150,
      useNativeDriver: true,
    });
    fadeOut.start(({ finished }) => {
      if (!finished) {
        return;
      }
      setThemeIcon(nextIcon);
      fadeIn.start();
    });
    return () => {
      fadeOut.stop();
      fadeIn.stop();
    };
  }, [nightMap, themeIconAnim]);

  useEffect(() => {
    altRoutesRef.current = altRoutes;
  }, [altRoutes]);

  useEffect(() => {
    setNightMap(isDark);
  }, [isDark]);

  const storePoint = useMemo(
    () => ({ latitude, longitude }),
    [latitude, longitude],
  );

  const routeSummary = formatRouteSummary(liveEtaSeconds, liveDistanceKm);

  const inject = useCallback((js: string) => {
    if (!webViewRef.current || !mapReadyRef.current) {
      return false;
    }
    webViewRef.current.injectJavaScript(`${js}; true;`);
    return true;
  }, []);

  useEffect(() => {
    inject(`window.setNight && window.setNight(${nightMap})`);
  }, [inject, nightMap]);

  const injectUserPosition = useCallback(
    (point: UserFix) => {
      lastUserRef.current = point;
      if (typeof point.heading === 'number' && point.heading >= 0) {
        lastHeadingRef.current = point.heading;
      }
      if (!webViewRef.current || !mapReadyRef.current) {
        pendingUserRef.current = point;
        console.log('[TaskMap] user:defer', point);
        return;
      }
      const heading =
        typeof point.heading === 'number' && point.heading >= 0
          ? point.heading
          : lastHeadingRef.current;
      console.log('[TaskMap] user:position', point);
      inject(
        `window.updateUserPosition && window.updateUserPosition(${point.latitude}, ${point.longitude}, ${heading})`,
      );
      pendingUserRef.current = null;
    },
    [inject],
  );

  const injectRoute = useCallback(
    (coords: FieldLatLng[], fit: boolean) => {
      if (!webViewRef.current) {
        console.log('[TaskMap] route:defer_no_webview', {
          points: coords.length,
        });
        pendingRouteRef.current = coords;
        pendingFitRef.current = fit;
        return;
      }
      if (!mapReadyRef.current) {
        console.log('[TaskMap] route:defer_map_not_ready', {
          points: coords.length,
        });
        pendingRouteRef.current = coords;
        pendingFitRef.current = fit;
        return;
      }
      const payload = JSON.stringify(coords);
      console.log('[TaskMap] route:injected', {
        points: coords.length,
        fit,
      });
      inject(`window.drawRoute && window.drawRoute(${payload}, ${fit})`);
      pendingRouteRef.current = null;
    },
    [inject],
  );

  const injectAltRoutes = useCallback(
    (routes: FieldAltRoute[], selectedIndex: number) => {
      if (!mapReadyRef.current) {
        pendingAltsRef.current = { routes, selectedIndex };
        return;
      }
      inject(
        `window.drawAltRoutes && window.drawAltRoutes(${JSON.stringify(routes)}, ${selectedIndex})`,
      );
      pendingAltsRef.current = null;
    },
    [inject],
  );

  const injectArrivalCircle = useCallback(
    (radiusM: number | null) => {
      if (radiusM == null || radiusM <= 0) {
        inject(
          `window.drawArrivalCircle && window.drawArrivalCircle(${storePoint.latitude}, ${storePoint.longitude}, 0)`,
        );
        return;
      }
      inject(
        `window.drawArrivalCircle && window.drawArrivalCircle(${storePoint.latitude}, ${storePoint.longitude}, ${radiusM})`,
      );
    },
    [inject, storePoint.latitude, storePoint.longitude],
  );

  const injectMapOptions = useCallback(() => {
    inject(`window.setMapType && window.setMapType('${mapTypeRef.current}')`);
    inject(`window.setNight && window.setNight(${nightMapRef.current})`);
    inject(`window.setFollowMe && window.setFollowMe(${followMeRef.current})`);
    if (arrivalRadiusRef.current != null) {
      injectArrivalCircle(arrivalRadiusRef.current);
    }
  }, [inject, injectArrivalCircle]);

  const applySelectedRoute = useCallback(
    (routes: FieldAltRoute[], index: number, fit: boolean) => {
      const selected = routes[index] ?? routes[0];
      if (!selected?.coordinates?.length) {
        return;
      }
      routeCoordsRef.current = selected.coordinates;
      setSelectedRoute(index);
      if (
        typeof selected.distance_meters === 'number' &&
        Number.isFinite(selected.distance_meters)
      ) {
        setLiveDistanceKm(selected.distance_meters / 1000);
        if (initialDistanceMRef.current && initialDistanceMRef.current > 0) {
          setRouteProgress(
            Math.max(
              0,
              Math.min(
                1,
                1 - selected.distance_meters / initialDistanceMRef.current,
              ),
            ),
          );
        }
      }
      if (
        typeof selected.duration_seconds === 'number' &&
        Number.isFinite(selected.duration_seconds)
      ) {
        setLiveEtaSeconds(selected.duration_seconds);
      }
      injectRoute(selected.coordinates, fit);
      injectAltRoutes(routes, index);
    },
    [injectAltRoutes, injectRoute],
  );

  const refreshRoute = useCallback(
    async (
      origin: FieldLatLng,
      options?: {
        showErrorBanner?: boolean;
        isCancelled?: () => boolean;
        resetProgress?: boolean;
        fit?: boolean;
      },
    ): Promise<boolean> => {
      const token = accessTokenRef.current;
      if (!token || routeRefreshInFlightRef.current) {
        return false;
      }

      routeRefreshInFlightRef.current = true;
      try {
        console.log('[TaskMap] directions:request', {
          originLatitude: origin.latitude,
          originLongitude: origin.longitude,
          destinationLatitude: storePoint.latitude,
          destinationLongitude: storePoint.longitude,
          mode: travelModeRef.current,
          avoid: avoidRef.current,
          showErrorBanner: Boolean(options?.showErrorBanner),
        });
        const result = await fetchFieldDirections(token, {
          originLatitude: origin.latitude,
          originLongitude: origin.longitude,
          destinationLatitude: storePoint.latitude,
          destinationLongitude: storePoint.longitude,
          mode: travelModeRef.current,
          avoid: avoidRef.current,
          alternatives: true,
        });
        if (options?.isCancelled?.()) {
          console.log('[TaskMap] directions:cancelled_after_response');
          return false;
        }
        console.log('[TaskMap] directions:ok', {
          points: result.coordinates?.length ?? 0,
          distance_meters: result.distance_meters,
          duration_seconds: result.duration_seconds,
          routes: result.routes?.length ?? 0,
          steps: result.steps?.length ?? 0,
        });
        lastRouteOriginRef.current = origin;
        lastRouteAtRef.current = Date.now();
        const routes: FieldAltRoute[] =
          result.routes && result.routes.length > 0
            ? result.routes
            : [
                {
                  summary: '',
                  coordinates: result.coordinates,
                  distance_meters: result.distance_meters,
                  duration_seconds: result.duration_seconds,
                  steps: result.steps ?? [],
                },
              ];
        setAltRoutes(routes);
        if (options?.resetProgress || initialDistanceMRef.current == null) {
          initialDistanceMRef.current =
            typeof routes[0]?.distance_meters === 'number'
              ? routes[0].distance_meters
              : result.distance_meters;
          setRouteProgress(0);
        }
        const fit =
          options?.fit ??
          (!routeFittedRef.current || Boolean(options?.resetProgress));
        if (fit) {
          routeFittedRef.current = true;
        }
        applySelectedRoute(routes, 0, fit);
        offRouteHitsRef.current = 0;
        if (offRouteRef.current) {
          setOffRoute(false);
          setBanner(null);
        }
        return true;
      } catch (e) {
        if (options?.isCancelled?.() || isRequestCanceled(e)) {
          console.log('[TaskMap] directions:cancelled');
          return false;
        }
        const message =
          e instanceof Error ? e.message : 'directions_failed';
        console.warn('[TaskMap] directions:error', { message });
        if (options?.showErrorBanner) {
          showMapError(message, { title: 'Route unavailable' });
        }
        return false;
      } finally {
        routeRefreshInFlightRef.current = false;
      }
    },
    [applySelectedRoute, storePoint.latitude, storePoint.longitude],
  );

  const maybeRerouteFromWatch = useCallback(
    (point: FieldLatLng) => {
      if (arrivingRef.current || taskArrivedRef.current) {
        return;
      }
      if (!accessTokenRef.current || routeRefreshInFlightRef.current) {
        return;
      }
      const lastOrigin = lastRouteOriginRef.current;
      if (!lastOrigin) {
        return;
      }
      const lastAt = lastRouteAtRef.current;
      if (
        lastAt != null &&
        Date.now() - lastAt < REROUTE_MIN_INTERVAL_MS
      ) {
        return;
      }

      const path = routeCoordsRef.current;
      const distToPath = minDistanceToPolylineMeters(point, path);
      const isOffRoute =
        distToPath != null && distToPath > OFF_ROUTE_THRESHOLD_M;
      if (isOffRoute) {
        offRouteHitsRef.current += 1;
      } else {
        offRouteHitsRef.current = 0;
        if (offRouteRef.current) {
          setOffRoute(false);
        }
      }

      const movedEnough =
        distanceMeters(lastOrigin, point) >= REROUTE_MIN_DISTANCE_M;
      const shouldOffRouteReroute =
        offRouteHitsRef.current >= OFF_ROUTE_HITS_NEEDED;

      if (!movedEnough && !shouldOffRouteReroute) {
        return;
      }
      if (shouldOffRouteReroute) {
        setOffRoute(true);
        setBanner('Off route — finding a new path…');
        setBannerTone('warning');
      }
      console.log('[TaskMap] directions:reroute_from_watch', {
        movedM: Math.round(distanceMeters(lastOrigin, point)),
        offRoute: shouldOffRouteReroute,
      });
      void refreshRoute(point, { showErrorBanner: false, fit: false });
    },
    [refreshRoute],
  );

  const onWebMessage = useCallback(
    (event: WebViewMessageEvent) => {
      try {
        const data = JSON.parse(event.nativeEvent.data) as {
          type?: string;
          points?: number;
          message?: string;
          index?: number;
        };
        console.log('[TaskMap] webview:message', data);
        if (data.type === 'map_ready') {
          mapReadyRef.current = true;
          console.log('[TaskMap] webview:load');
          injectMapOptions();
          if (pendingUserRef.current) {
            injectUserPosition(pendingUserRef.current);
          }
          if (pendingRouteRef.current) {
            injectRoute(pendingRouteRef.current, pendingFitRef.current);
          }
          if (pendingAltsRef.current) {
            injectAltRoutes(
              pendingAltsRef.current.routes,
              pendingAltsRef.current.selectedIndex,
            );
          }
        } else if (data.type === 'map_error') {
          console.warn('[TaskMap] webview:error', data.message);
          showMapError(AUTH_ERRORS.DIRECTIONS_FAILED, { title: 'Maps' });
        } else if (data.type === 'route_drawn') {
          console.log('[TaskMap] route:drawn', { points: data.points });
        } else if (data.type === 'route_error') {
          console.warn('[TaskMap] route:error', data.message);
        } else if (data.type === 'user_error') {
          console.warn('[TaskMap] user:error', data.message);
        } else if (data.type === 'user_dragged') {
          setFollowMe(false);
        } else if (
          data.type === 'alt_tapped' &&
          typeof data.index === 'number'
        ) {
          applySelectedRoute(altRoutesRef.current, data.index, false);
        }
      } catch (e) {
        console.warn('[TaskMap] webview:bad_message', e);
      }
    },
    [
      applySelectedRoute,
      injectAltRoutes,
      injectMapOptions,
      injectRoute,
      injectUserPosition,
    ],
  );

  const bootstrap = useCallback(
    async (isCancelled: () => boolean) => {
      const token = accessTokenRef.current;
      console.log('[TaskMap] bootstrap:start', {
        taskId,
        title,
        storePoint,
        hasToken: Boolean(token),
      });
      setLoading(true);
      setBanner(null);
      setBannerTone('error');
      setMapHtml(null);
      mapReadyRef.current = false;
      pendingRouteRef.current = null;
      pendingAltsRef.current = null;
      pendingUserRef.current = null;
      lastRouteOriginRef.current = null;
      lastRouteAtRef.current = null;
      routeRefreshInFlightRef.current = false;
      routeFittedRef.current = false;
      routeCoordsRef.current = [];
      offRouteHitsRef.current = 0;
      initialDistanceMRef.current = null;
      setOffRoute(false);
      setAltRoutes([]);
      setSelectedRoute(0);
      setRouteProgress(null);
      setFollowMe(true);
      followMeRef.current = true;

      if (!token) {
        console.warn('[TaskMap] bootstrap:no_token');
        showMapError(AUTH_ERRORS.UNAUTHORIZED, { title: 'Session expired' });
        setLoading(false);
        return;
      }

      try {
        console.log('[TaskMap] task-detail:request', { taskId });
        const detail = await fetchFieldTaskDetail(token, taskId);
        if (isCancelled()) {
          console.log('[TaskMap] bootstrap:cancelled_after_task_detail');
          return;
        }
        const isPaused = detail.status === 'paused';
        const started = isTaskStartedStatus(detail.status, detail.state);
        const hasStop =
          typeof detail.stop_id === 'number' && detail.stop_id > 0;
        const isArrived = hasStop && !isPaused;
        console.log('[TaskMap] task-detail:ok', {
          status: detail.status,
          state: detail.state,
          taskStarted: started,
          stopId: detail.stop_id,
          arrived: isArrived,
          arrival_radius_m: detail.arrival_radius_m,
        });
        const upcoming = Boolean(detail.is_upcoming);
        setTaskStatus(detail.status);
        setIsUpcoming(upcoming);
        setPauseReasonLine(
          isPaused ? formatPauseReasonLine(detail) : null,
        );
        setTaskStarted(!isPaused && (started || isArrived));
        setTaskArrived(isArrived);
        setStopId(hasStop ? (detail.stop_id as number) : null);
        setRequirements(detail.requirements ?? null);
        setCancelReasons(detail.cancel_reasons ?? []);
        setPauseReasons(detail.pause_reasons ?? []);
        if (upcoming) {
          setBanner('This task is not active yet');
          setBannerTone('info');
        }
        const radius =
          typeof detail.arrival_radius_m === 'number' &&
          detail.arrival_radius_m > 0
            ? detail.arrival_radius_m
            : null;
        setArrivalRadiusM(radius);
        arrivalRadiusRef.current = radius;
        if (hasStop) {
          await saveTaskProgress(taskId, {
            stop_id: detail.stop_id as number,
          });
        }
      } catch (e) {
        if (isCancelled() || isRequestCanceled(e)) {
          console.log('[TaskMap] task-detail:cancelled');
          return;
        }
        console.warn('[TaskMap] task-detail:error', {
          message: e instanceof Error ? e.message : e,
        });
      }

      let apiKey: string | null = null;
      try {
        console.log('[TaskMap] map-config:request');
        const config = await fetchFieldMapConfig(token);
        if (isCancelled()) {
          console.log('[TaskMap] bootstrap:cancelled_after_map_config');
          return;
        }
        console.log('[TaskMap] map-config:ok', {
          maps_configured: config.maps_configured,
          keyLength: config.google_maps_api_key?.length ?? 0,
        });
        if (!config.maps_configured || !config.google_maps_api_key) {
          console.warn('[TaskMap] map-config:not_configured');
          showMapError(AUTH_ERRORS.MAPS_NOT_CONFIGURED, {
            title: 'Maps not configured',
          });
          setLoading(false);
          return;
        }
        apiKey = config.google_maps_api_key;
      } catch (e) {
        if (isCancelled() || isRequestCanceled(e)) {
          console.log('[TaskMap] map-config:cancelled');
          return;
        }
        const message =
          e instanceof Error ? e.message : 'directions_failed';
        console.warn('[TaskMap] map-config:error', { message });
        showMapError(message, { title: 'Maps' });
        setLoading(false);
        return;
      }

      const html = buildGoogleMapsHtml({
        apiKey,
        latitude: storePoint.latitude,
        longitude: storePoint.longitude,
        title,
        night: nightMapRef.current,
      });
      console.log('[TaskMap] webview:html_ready', {
        htmlLength: html.length,
      });
      setMapHtml(html);

      let origin: UserFix | null = null;
      try {
        const coords = await getCurrentCoordinates();
        if (isCancelled()) {
          console.log('[TaskMap] bootstrap:cancelled_after_location');
          return;
        }
        origin = {
          latitude: coords.latitude,
          longitude: coords.longitude,
          heading:
            typeof coords.heading === 'number' ? coords.heading : null,
        };
        console.log('[TaskMap] location:ok', origin);
        injectUserPosition(origin);
        void saveLastKnownFix({
          latitude: origin.latitude,
          longitude: origin.longitude,
          heading: origin.heading,
          at: Date.now(),
        });
      } catch {
        if (isCancelled()) {
          return;
        }
        console.warn('[TaskMap] location:failed');
        const cached = await loadLastKnownFix();
        if (cached) {
          origin = {
            latitude: cached.latitude,
            longitude: cached.longitude,
            heading: cached.heading,
          };
          injectUserPosition(origin);
          setBanner(
            `Last known location · ${formatLastKnownAge(cached.at)}`,
          );
          setBannerTone('warning');
        } else {
          showAlert({
            title: 'Location required',
            message: 'Enable location to see your route.',
            confirmText: 'OK',
          });
        }
      }

      if (origin) {
        await refreshRoute(origin, {
          showErrorBanner: true,
          isCancelled,
          resetProgress: true,
          fit: true,
        });
      }

      if (!isCancelled()) {
        setLoading(false);
        console.log('[TaskMap] bootstrap:done');
      }
    },
    [injectUserPosition, refreshRoute, storePoint, taskId, title],
  );

  const handleStartTask = useCallback(async () => {
    if (!accessToken || startingTask || taskStarted) {
      return;
    }
    if (
      isTaskStartBlocked({
        status: taskStatus ?? '',
        is_upcoming: isUpcoming,
      })
    ) {
      setBanner('This task is not active yet');
      setBannerTone('info');
      return;
    }
    setStartingTask(true);
    setBanner(null);
    setBannerTone('error');
    try {
      console.log('[TaskMap] start-task:request', { taskId });
      const coords = await getCurrentCoordinates();
      const origin: UserFix = {
        latitude: coords.latitude,
        longitude: coords.longitude,
        heading: typeof coords.heading === 'number' ? coords.heading : null,
      };
      injectUserPosition(origin);

      const progress = await loadTaskProgress(taskId);
      const pointUuid = progress.point_uuid || createPointUuid();
      await saveTaskProgress(taskId, { point_uuid: pointUuid });

      const startParams: {
        latitude: number;
        longitude: number;
        accuracy?: number;
        point_uuid: string;
        device_timestamp: string;
      } = {
        latitude: coords.latitude,
        longitude: coords.longitude,
        point_uuid: pointUuid,
        device_timestamp: formatOdooDeviceTimestamp(),
      };
      if (typeof coords.accuracy === 'number') {
        startParams.accuracy = coords.accuracy;
      }

      const started = await startFieldTask(accessToken, taskId, startParams);
      console.log('[TaskMap] start-task:ok', {
        taskId: started.task_id,
        status: started.status,
        state: started.state,
      });

      await startLocationTracking(accessToken);
      console.log('[TaskMap] tracking:ensured');
      setTaskStarted(true);
      setTaskStatus(started.status ?? 'active');
      setIsUpcoming(false);
      setPauseReasonLine(null);
      setBanner(null);
      if (started.state === 'arrived') {
        let arrivedStopId =
          typeof started.stop_id === 'number' && started.stop_id > 0
            ? started.stop_id
            : typeof stopId === 'number' && stopId > 0
              ? stopId
              : null;
        if (arrivedStopId == null) {
          try {
            const detail = await fetchFieldTaskDetail(accessToken, taskId);
            if (typeof detail.stop_id === 'number' && detail.stop_id > 0) {
              arrivedStopId = detail.stop_id;
              setRequirements(detail.requirements ?? null);
              setCancelReasons(detail.cancel_reasons ?? []);
              setPauseReasons(detail.pause_reasons ?? []);
            }
          } catch {
            // Keep started without arrived until stop id is known.
          }
        }
        if (arrivedStopId != null) {
          await saveTaskProgress(taskId, { stop_id: arrivedStopId });
          setStopId(arrivedStopId);
          setTaskArrived(true);
        }
      }
    } catch (e) {
      const message =
        e instanceof Error ? e.message : 'task_start_failed';
      console.warn('[TaskMap] start-task:error', { message });
      if (message === AUTH_ERRORS.NO_OPEN_ATTENDANCE) {
        showAlert({
          title: 'Check in first',
          message: getAuthErrorMessage(message),
          onConfirm: () => navigation.navigate(ScreenNames.CHECK_IN),
        });
        return;
      }
      if (message === AUTH_ERRORS.TASK_ALREADY_ACTIVE) {
        showAlert({
          title: 'Task already active',
          message: getAuthErrorMessage(message),
          onConfirm: () => popToScreen(navigation, ScreenNames.TASK_ROUTING),
        });
        return;
      }
      showMapError(message);
    } finally {
      setStartingTask(false);
    }
  }, [
    accessToken,
    injectUserPosition,
    isUpcoming,
    navigation,
    startingTask,
    stopId,
    taskId,
    taskStarted,
    taskStatus,
  ]);

  const handleArrive = useCallback(async () => {
    if (!accessToken || arriving || !taskStarted || taskArrived) {
      return;
    }
    setArriving(true);
    setBanner(null);
    setBannerTone('error');
    try {
      const coords = await getCurrentCoordinates();
      const progress = await loadTaskProgress(taskId);
      const stopUuid = progress.stop_uuid || createPointUuid();
      const pointUuid = createPointUuid();
      await saveTaskProgress(taskId, {
        stop_uuid: stopUuid,
        point_uuid: progress.point_uuid || pointUuid,
      });

      const result = await arriveFieldTask(accessToken, taskId, {
        latitude: coords.latitude,
        longitude: coords.longitude,
        accuracy:
          typeof coords.accuracy === 'number' ? coords.accuracy : undefined,
        stop_uuid: stopUuid,
        point_uuid: pointUuid,
        device_timestamp: formatOdooDeviceTimestamp(),
      });

      const nextStopId = result.stop.stop_id;
      const nextRequirements = result.task.requirements ?? requirements;
      await saveTaskProgress(taskId, { stop_id: nextStopId });
      setStopId(nextStopId);
      setTaskArrived(true);
      setTaskStarted(true);
      setRequirements(nextRequirements);
      setCancelReasons(result.task.cancel_reasons ?? cancelReasons);
      setPauseReasons(result.task.pause_reasons ?? pauseReasons);
      console.log('[TaskMap] arrive:ok', { stopId: nextStopId });

      navigation.navigate(ScreenNames.TASK_CAPTURE, {
        taskId,
        stopId: nextStopId,
        requirements: nextRequirements ?? undefined,
        title,
        address,
      });
    } catch (e) {
      const message =
        e instanceof Error ? e.message : 'task_arrive_failed';
      console.warn('[TaskMap] arrive:error', { message });
      if (message === AUTH_ERRORS.GPS_REQUIRED) {
        showMapError(message);
        return;
      }
      if (message === AUTH_ERRORS.TASK_TOO_FAR) {
        showAlert({
          title: 'Too far from store',
          message: getAuthErrorMessage(message),
          confirmText: 'OK',
        });
        return;
      }
      if (message === AUTH_ERRORS.TASK_INVALID_STATE) {
        setReloadKey((k) => k + 1);
        showMapError(message);
        return;
      }
      if (message === AUTH_ERRORS.NO_OPEN_ATTENDANCE) {
        showAlert({
          title: 'Check in first',
          message: getAuthErrorMessage(message),
          onConfirm: () => navigation.navigate(ScreenNames.CHECK_IN),
        });
        return;
      }
      showMapError(message);
    } finally {
      setArriving(false);
    }
  }, [
    accessToken,
    address,
    arriving,
    cancelReasons,
    navigation,
    pauseReasons,
    requirements,
    taskArrived,
    taskId,
    taskStarted,
    title,
  ]);

  const openContinueVisit = useCallback(async () => {
    let nextStopId = stopId;
    let nextRequirements = requirements;

    if (nextStopId == null && accessToken) {
      try {
        const detail = await fetchFieldTaskDetail(accessToken, taskId);
        if (typeof detail.stop_id === 'number' && detail.stop_id > 0) {
          nextStopId = detail.stop_id;
          nextRequirements = detail.requirements ?? nextRequirements;
          setStopId(nextStopId);
          setTaskArrived(true);
          setRequirements(nextRequirements);
          await saveTaskProgress(taskId, { stop_id: nextStopId });
        }
      } catch (e) {
        const message =
          e instanceof Error ? e.message : 'task_detail_failed';
        showAlert({
          title: 'Could not open visit',
          message: getAuthErrorMessage(message),
        });
        return;
      }
    }

    if (nextStopId == null) {
      showAlert({
        title: 'Arrive first',
        message: 'Mark Reached before continuing the visit.',
      });
      return;
    }

    navigation.navigate(ScreenNames.TASK_CAPTURE, {
      taskId,
      stopId: nextStopId,
      requirements: nextRequirements ?? undefined,
      title,
      address,
    });
  }, [
    accessToken,
    address,
    navigation,
    requirements,
    stopId,
    taskId,
    title,
  ]);

  const submitCancel = useCallback(async () => {
    if (!accessToken || !cancelReason || cancelling) {
      return;
    }
    if (cancelReason === 'other' && !cancelNote.trim()) {
      showAlert({
        title: 'Note required',
        message: 'Please add a note when cancel reason is Other.',
      });
      return;
    }
    setCancelling(true);
    try {
      await cancelFieldTask(accessToken, taskId, {
        reason: cancelReason,
        note: cancelNote.trim() || undefined,
      });
      await clearTaskProgress(taskId);
      await syncTrackingAfterTaskTerminal(accessToken);
      setCancelVisible(false);
      popToScreen(navigation, ScreenNames.TASK_ROUTING);
    } catch (e) {
      const message =
        e instanceof Error ? e.message : 'task_cancel_failed';
      showAlert({
        title: 'Could not cancel',
        message: getAuthErrorMessage(message),
      });
    } finally {
      setCancelling(false);
    }
  }, [
    accessToken,
    cancelNote,
    cancelReason,
    cancelling,
    navigation,
    taskId,
  ]);

  const submitPause = useCallback(async () => {
    if (!accessToken || !pauseReason || pausing) {
      return;
    }
    if (pauseReason === 'other' && !pauseNote.trim()) {
      showAlert({
        title: 'Note required',
        message: 'Please add a note when pause reason is Other.',
      });
      return;
    }
    setPausing(true);
    try {
      const progress = await loadTaskProgress(taskId);
      const pointUuid = progress.pause_point_uuid || createPointUuid();
      await saveTaskProgress(taskId, { pause_point_uuid: pointUuid });

      const pauseParams: {
        reason: string;
        note?: string;
        latitude?: number;
        longitude?: number;
        accuracy?: number;
        point_uuid: string;
        device_timestamp: string;
      } = {
        reason: pauseReason,
        note: pauseNote.trim() || undefined,
        point_uuid: pointUuid,
        device_timestamp: formatOdooDeviceTimestamp(),
      };

      try {
        const coords = await getCurrentCoordinates();
        pauseParams.latitude = coords.latitude;
        pauseParams.longitude = coords.longitude;
        if (typeof coords.accuracy === 'number') {
          pauseParams.accuracy = coords.accuracy;
        }
      } catch {
        // GPS is optional for pause; continue with reason only.
      }

      await pauseFieldTask(accessToken, taskId, pauseParams);
      await clearTaskProgress(taskId);
      setPauseVisible(false);
      popToScreen(navigation, ScreenNames.TASK_ROUTING);
    } catch (e) {
      const message =
        e instanceof Error ? e.message : 'task_pause_failed';
      showAlert({
        title: 'Could not pause',
        message: getAuthErrorMessage(message),
      });
    } finally {
      setPausing(false);
    }
  }, [
    accessToken,
    navigation,
    pauseNote,
    pauseReason,
    pausing,
    taskId,
  ]);

  const requestRouteRefresh = useCallback(
    (resetProgress: boolean) => {
      const origin = lastUserRef.current;
      if (!origin) {
        return;
      }
      void refreshRoute(origin, {
        showErrorBanner: true,
        resetProgress,
        fit: true,
      });
    },
    [refreshRoute],
  );

  const handleSelectMapType = useCallback(
    (next: MapTypeId) => {
      setMapType(next);
      setOpenMenu(null);
      inject(`window.setMapType && window.setMapType('${next}')`);
    },
    [inject],
  );

  const handleToggleNight = useCallback(() => {
    setNightMap((current) => {
      const next = !current;
      inject(`window.setNight && window.setNight(${next})`);
      return next;
    });
  }, [inject]);

  const handleRecenter = useCallback(() => {
    const point = lastUserRef.current;
    if (!point) {
      return;
    }
    setFollowMe(true);
    followMeRef.current = true;
    inject(`window.setFollowMe && window.setFollowMe(true)`);
    inject(
      `window.recenter && window.recenter(${point.latitude}, ${point.longitude})`,
    );
  }, [inject]);

  const handleSelectTravelMode = useCallback(
    (next: TravelMode) => {
      setOpenMenu(null);
      if (next === travelModeRef.current) {
        return;
      }
      setTravelMode(next);
      travelModeRef.current = next;
      requestRouteRefresh(true);
    },
    [requestRouteRefresh],
  );

  const handleOpenExternalMaps = useCallback(() => {
    void openExternalMaps(
      storePoint.latitude,
      storePoint.longitude,
      travelMode,
    ).catch((e) => {
      console.warn('[TaskMap] open_maps:error', e);
      showAlert({
        title: 'Maps',
        message: 'Could not open Maps.',
        confirmText: 'OK',
      });
    });
  }, [storePoint.latitude, storePoint.longitude, travelMode]);

  const handleSelectAltRoute = useCallback(
    (index: number) => {
      applySelectedRoute(altRoutes, index, false);
    },
    [altRoutes, applySelectedRoute],
  );

  const fastestIndex = useMemo(() => {
    if (altRoutes.length === 0) {
      return 0;
    }
    let best = 0;
    for (let i = 1; i < altRoutes.length; i += 1) {
      if (altRoutes[i].duration_seconds < altRoutes[best].duration_seconds) {
        best = i;
      }
    }
    return best;
  }, [altRoutes]);

  const shortestIndex = useMemo(() => {
    if (altRoutes.length === 0) {
      return 0;
    }
    let best = 0;
    for (let i = 1; i < altRoutes.length; i += 1) {
      if (altRoutes[i].distance_meters < altRoutes[best].distance_meters) {
        best = i;
      }
    }
    return best;
  }, [altRoutes]);

  const altRouteLabel = useCallback(
    (route: FieldAltRoute, index: number) => {
      const parts: string[] = [];
      if (index === fastestIndex) {
        parts.push('Fastest');
      } else if (index === shortestIndex) {
        parts.push('Shortest');
      } else if (route.summary) {
        parts.push(route.summary);
      } else {
        parts.push(`Route ${index + 1}`);
      }
      parts.push(formatEta(route.duration_seconds));
      return parts.join(' · ');
    },
    [fastestIndex, shortestIndex],
  );

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      void bootstrap(() => cancelled);

      watchIdRef.current = Geolocation.watchPosition(
        (position) => {
          if (cancelled) {
            return;
          }
          const heading =
            typeof position.coords.heading === 'number' &&
            position.coords.heading >= 0
              ? position.coords.heading
              : null;
          const point: UserFix = {
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
            heading,
          };
          injectUserPosition(point);
          void saveLastKnownFix({
            latitude: point.latitude,
            longitude: point.longitude,
            heading: point.heading,
            at: Date.now(),
          });
          maybeRerouteFromWatch(point);
        },
        (error) => {
          console.warn('[TaskMap] watch:error', error);
        },
        {
          enableHighAccuracy: true,
          distanceFilter: 0,
          interval: 1000,
          fastestInterval: 500,
          showsBackgroundLocationIndicator: false,
        },
      );

      return () => {
        cancelled = true;
        console.log('[TaskMap] focus:cleanup');
        if (watchIdRef.current != null) {
          Geolocation.clearWatch(watchIdRef.current);
          watchIdRef.current = null;
        }
      };
    }, [bootstrap, inject, injectUserPosition, maybeRerouteFromWatch, reloadKey]),
  );

  const renderChip = (
    label: string,
    selected: boolean,
    onPress: () => void,
    accessibilityLabel: string,
  ) => (
    <Pressable
      key={accessibilityLabel}
      style={[styles.chip, selected && styles.chipSelected]}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      accessibilityLabel={accessibilityLabel}
    >
      <Text style={[styles.chipText, selected && styles.chipTextSelected]}>
        {label}
      </Text>
    </Pressable>
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
            style={styles.backButton}
            onPress={() => navigation.goBack()}
            accessibilityRole="button"
            accessibilityLabel="Back"
          >
            <MaterialIcons
              name="arrow-back"
              size={isTablet ? 26 : 22}
              color={colors.textEnabled}
            />
          </Pressable>
          <Text style={styles.headerTitle} numberOfLines={1}>
            {title}
          </Text>
          <Pressable
            onPress={() => {
              if (taskStarted) {
                showAlert({
                  title: 'Task in progress',
                  message: getAuthErrorMessage(AUTH_ERRORS.TASK_IN_PROGRESS),
                });
                return;
              }
            }}
            disabled={taskStarted}
            accessibilityRole="button"
            accessibilityLabel="Check out"
            accessibilityState={{ disabled: taskStarted }}
          >
            <LinearGradient
              colors={[...colors.buttonGradient]}
              start={{ x: 0, y: 0 }}
              end={{ x: 0, y: 1 }}
              style={[
                styles.checkOutButton,
                taskStarted && styles.checkOutButtonDisabled,
              ]}
            >
              <Text style={styles.checkOutText}>Check out</Text>
            </LinearGradient>
          </Pressable>
        </View>

      <View style={styles.mapWrap}>
        {mapHtml ? (
          <MapWebView
            ref={webViewRef}
            style={styles.map}
            originWhitelist={['*']}
            javaScriptEnabled
            domStorageEnabled
            mixedContentMode="always"
            setSupportMultipleWindows={false}
            source={{ html: mapHtml, baseUrl: 'https://maps.googleapis.com' }}
            onMessage={onWebMessage}
            onError={(e: { nativeEvent: unknown }) => {
              console.warn('[TaskMap] webview:error', e.nativeEvent);
              showAlert({
                title: 'Maps',
                message: 'Could not load Google Maps.',
                confirmText: 'Retry',
                cancelText: 'Cancel',
                onConfirm: () => setReloadKey((k) => k + 1),
              });
            }}
            onHttpError={(e: { nativeEvent: unknown }) => {
              console.warn('[TaskMap] webview:http_error', e.nativeEvent);
            }}
          />
        ) : null}

        <View style={styles.fabStack}>
          <Pressable
            style={styles.fabButton}
            onPress={handleToggleNight}
            accessibilityRole="button"
            accessibilityLabel={nightMap ? 'Light map' : 'Night map'}
            accessibilityState={{ selected: nightMap }}
          >
            <Animated.View
              style={{
                opacity: themeIconAnim,
                transform: [
                  {
                    rotate: themeIconAnim.interpolate({
                      inputRange: [0, 1],
                      outputRange: ['90deg', '0deg'],
                    }),
                  },
                ],
              }}
            >
              <MaterialIcons
                name={themeIcon}
                size={isTablet ? 22 : 20}
                color={colors.textEnabled}
              />
            </Animated.View>
          </Pressable>
          <Pressable
            style={styles.fabButton}
            onPress={() => inject('window.zoomBy && window.zoomBy(1)')}
            accessibilityRole="button"
            accessibilityLabel="Zoom in"
          >
            <MaterialIcons
              name="add"
              size={isTablet ? 24 : 22}
              color={colors.textEnabled}
            />
          </Pressable>
          <Pressable
            style={styles.fabButton}
            onPress={() => inject('window.zoomBy && window.zoomBy(-1)')}
            accessibilityRole="button"
            accessibilityLabel="Zoom out"
          >
            <MaterialIcons
              name="remove"
              size={isTablet ? 24 : 22}
              color={colors.textEnabled}
            />
          </Pressable>
          <View
            style={[styles.fabRow, openMenu === 'map' && styles.fabRowOpen]}
          >
            <Pressable
              style={[
                styles.fabButton,
                openMenu === 'map' && styles.fabButtonActive,
              ]}
              onPress={() =>
                setOpenMenu((current) => (current === 'map' ? null : 'map'))
              }
              accessibilityRole="button"
              accessibilityLabel="Map view"
              accessibilityState={{ expanded: openMenu === 'map' }}
            >
              <MaterialIcons
                name="layers"
                size={isTablet ? 22 : 20}
                color={openMenu === 'map' ? colors.button : colors.textEnabled}
              />
            </Pressable>
            {openMenu === 'map' ? (
              <View style={styles.fabMenu}>
                {MAP_TYPES.map((item) =>
                  renderChip(
                    item.label,
                    mapType === item.id,
                    () => handleSelectMapType(item.id),
                    item.label,
                  ),
                )}
              </View>
            ) : null}
          </View>
          <View
            style={[styles.fabRow, openMenu === 'route' && styles.fabRowOpen]}
          >
            <Pressable
              style={[
                styles.fabButton,
                openMenu === 'route' && styles.fabButtonActive,
              ]}
              onPress={() =>
                setOpenMenu((current) => (current === 'route' ? null : 'route'))
              }
              accessibilityRole="button"
              accessibilityLabel="Route mode"
              accessibilityState={{ expanded: openMenu === 'route' }}
            >
              <MaterialIcons
                name={
                  travelMode === 'walking'
                    ? 'directions-walk'
                    : 'directions-car'
                }
                size={isTablet ? 22 : 20}
                color={
                  openMenu === 'route' ? colors.button : colors.textEnabled
                }
              />
            </Pressable>
            {openMenu === 'route' ? (
              <View style={styles.fabMenu}>
                {TRAVEL_MODES.map((item) =>
                  renderChip(
                    item.label,
                    travelMode === item.id,
                    () => handleSelectTravelMode(item.id),
                    item.label,
                  ),
                )}
              </View>
            ) : null}
          </View>
          <Pressable
            style={styles.fabButton}
            onPress={handleOpenExternalMaps}
            accessibilityRole="button"
            accessibilityLabel="Open in Maps"
          >
            <MaterialIcons
              name="launch"
              size={isTablet ? 22 : 20}
              color={colors.textEnabled}
            />
          </Pressable>
          <Pressable
            style={[styles.fabButton, followMe && styles.fabButtonActive]}
            onPress={handleRecenter}
            accessibilityRole="button"
            accessibilityLabel="My location"
            accessibilityState={{ selected: followMe }}
          >
            <MaterialIcons
              name="my-location"
              size={isTablet ? 22 : 20}
              color={followMe ? colors.button : colors.textEnabled}
            />
          </Pressable>
        </View>

        {banner ? (
          <View
            style={[styles.mapBanner, loading && styles.mapBannerBelowLoader]}
          >
            <Text
              style={[
                styles.bannerText,
                bannerTone === 'error' && styles.bannerError,
                bannerTone === 'warning' && styles.bannerWarning,
                bannerTone === 'info' && styles.bannerInfo,
              ]}
            >
              {banner}
            </Text>
            {bannerTone === 'error' ? (
              <Pressable
                onPress={() => setReloadKey((k) => k + 1)}
                accessibilityRole="button"
                accessibilityLabel="Retry"
              >
                <Text style={styles.retryText}>Retry</Text>
              </Pressable>
            ) : null}
          </View>
        ) : null}

        {loading ? (
          <View style={styles.mapLoader}>
            <ActivityIndicator color={colors.button} />
          </View>
        ) : null}

        <View style={[styles.card, { bottom: isTablet ? 24 : 16 }]}>
            <Pressable
              style={styles.cardHeader}
              onPress={() => setCardExpanded((v) => !v)}
              accessibilityRole="button"
              accessibilityState={{ expanded: cardExpanded }}
              accessibilityLabel={
                cardExpanded ? 'Collapse task card' : 'Expand task card'
              }
            >
              <Text style={styles.cardTitle} numberOfLines={1}>
                {title}
              </Text>
              <View style={styles.cardHeaderMeta}>
                {!cardExpanded && routeSummary ? (
                  <Text style={styles.cardDistanceCompact}>{routeSummary}</Text>
                ) : null}
                <MaterialIcons
                  name={
                    cardExpanded ? 'keyboard-arrow-down' : 'keyboard-arrow-up'
                  }
                  size={isTablet ? 28 : 24}
                  color={colors.textDisabled}
                />
              </View>
            </Pressable>

            {routeProgress != null ? (
              <View style={styles.progressTrack}>
                <View
                  style={[
                    styles.progressFill,
                    { width: `${Math.round(routeProgress * 100)}%` },
                  ]}
                />
              </View>
            ) : null}

            {cardExpanded ? (
              <>
                <View style={styles.cardAddressRow}>
                  <MaterialIcons
                    name="place"
                    size={isTablet ? 18 : 16}
                    color={colors.textDisabled}
                  />
                  <Text style={styles.cardAddress}>{address || '—'}</Text>
                </View>
                {pauseReasonLine ? (
                  <Text style={styles.pauseReasonText}>{pauseReasonLine}</Text>
                ) : null}
                {routeSummary ? (
                  <Text style={styles.cardDistance}>{routeSummary} away</Text>
                ) : liveDistanceKm != null ? (
                  <Text style={styles.cardDistance}>
                    {`${formatDistanceKm(liveDistanceKm)} away`}
                  </Text>
                ) : null}

                {altRoutes.length > 1 ? (
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    style={styles.chipScroll}
                    contentContainerStyle={[
                      styles.chipScrollContent,
                      { marginTop: isTablet ? 12 : 10 },
                    ]}
                  >
                    {altRoutes.map((item, index) => (
                      <Pressable
                        key={`${item.summary}-${index}`}
                        style={[
                          styles.altChip,
                          selectedRoute === index && styles.altChipSelected,
                        ]}
                        onPress={() => handleSelectAltRoute(index)}
                        accessibilityRole="button"
                        accessibilityState={{
                          selected: selectedRoute === index,
                        }}
                        accessibilityLabel={altRouteLabel(item, index)}
                      >
                        <Text
                          style={[
                            styles.altChipText,
                            selectedRoute === index &&
                              styles.altChipTextSelected,
                          ]}
                        >
                          {altRouteLabel(item, index)}
                        </Text>
                      </Pressable>
                    ))}
                  </ScrollView>
                ) : null}

                <View style={styles.cardActions}>
                  {!taskStarted ? (
                    <Pressable
                      style={[
                        styles.startButton,
                        (startingTask || isUpcoming) &&
                          styles.startButtonDisabled,
                      ]}
                      onPress={() => {
                        void handleStartTask();
                      }}
                      disabled={startingTask || isUpcoming}
                      accessibilityRole="button"
                      accessibilityState={{
                        disabled: startingTask || isUpcoming,
                      }}
                      accessibilityLabel={
                        taskStatus === 'paused' ? 'Resume Task' : 'Start Task'
                      }
                    >
                      {startingTask ? (
                        <ActivityIndicator color="#0B1422" />
                      ) : (
                        <Text style={styles.startButtonText}>
                          {taskStatus === 'paused'
                            ? 'Resume Task'
                            : 'Start Task'}
                        </Text>
                      )}
                    </Pressable>
                  ) : !taskArrived ? (
                    <Pressable
                      style={[
                        styles.startButton,
                        arriving && styles.startButtonDisabled,
                      ]}
                      onPress={() => {
                        void handleArrive();
                      }}
                      disabled={arriving}
                      accessibilityRole="button"
                      accessibilityLabel="Reached"
                    >
                      {arriving ? (
                        <ActivityIndicator color="#0B1422" />
                      ) : (
                        <Text style={styles.startButtonText}>Reached</Text>
                      )}
                    </Pressable>
                  ) : (
                    <Pressable
                      style={styles.startButton}
                      onPress={() => {
                        void openContinueVisit();
                      }}
                      accessibilityRole="button"
                      accessibilityLabel="Continue Visit"
                    >
                      <Text style={styles.startButtonText}>Continue Visit</Text>
                    </Pressable>
                  )}

                  <Pressable
                    style={styles.detailsButton}
                    onPress={() =>
                      navigation.navigate(ScreenNames.WHAT_NEEDS_TO_BE_DONE, {
                        taskId,
                      })
                    }
                    accessibilityRole="button"
                    accessibilityLabel="View Details"
                  >
                    <LinearGradient
                      colors={[...colors.buttonGradient]}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 0, y: 1 }}
                      style={styles.detailsGradient}
                    >
                      <MaterialIcons
                        name="visibility"
                        size={isTablet ? 18 : 16}
                        color={colors.buttonText}
                      />
                      <Text style={styles.detailsButtonText}>View Details</Text>
                    </LinearGradient>
                  </Pressable>
                </View>

                {taskStarted ? (
                  <View style={styles.secondaryActions}>
                    {!taskArrived ? (
                      <Pressable
                        style={styles.pauseLink}
                        onPress={() => {
                          setPauseReason(null);
                          setPauseNote('');
                          setPauseVisible(true);
                        }}
                        accessibilityRole="button"
                        accessibilityLabel="Pause task"
                      >
                        <Text style={styles.pauseLinkText}>Pause task</Text>
                      </Pressable>
                    ) : null}
                    <Pressable
                      style={styles.cancelLink}
                      onPress={() => {
                        setCancelReason(null);
                        setCancelNote('');
                        setCancelVisible(true);
                      }}
                      accessibilityRole="button"
                      accessibilityLabel="Cancel task"
                    >
                      <Text style={styles.cancelLinkText}>Cancel task</Text>
                    </Pressable>
                  </View>
                ) : null}
              </>
            ) : null}
          </View>
      </View>

      <Modal
        visible={pauseVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setPauseVisible(false)}
      >
        <View style={styles.cancelModalOverlay}>
          <View style={styles.cancelModalCard}>
            <Text style={styles.cancelModalTitle}>Pause task</Text>
            <Text style={styles.cancelModalSubtitle}>Select a reason</Text>
            {(pauseReasons.length > 0
              ? pauseReasons
              : [{ value: 'other', label: 'Other' }]
            ).map((reason) => (
              <Pressable
                key={reason.value}
                style={[
                  styles.cancelReasonRow,
                  pauseReason === reason.value &&
                    styles.cancelReasonRowSelected,
                ]}
                onPress={() => setPauseReason(reason.value)}
              >
                <Text style={styles.cancelReasonText}>{reason.label}</Text>
              </Pressable>
            ))}
            {pauseReason === 'other' ? (
              <TextInput
                style={styles.cancelNoteInput}
                placeholder="Add a note"
                placeholderTextColor={colors.textDisabled}
                value={pauseNote}
                onChangeText={setPauseNote}
                multiline
              />
            ) : null}
            <View style={styles.cancelModalActions}>
              <Pressable
                style={styles.cancelModalSecondary}
                onPress={() => setPauseVisible(false)}
                disabled={pausing}
              >
                <Text style={styles.cancelModalSecondaryText}>Back</Text>
              </Pressable>
              <Pressable
                style={styles.cancelModalPrimary}
                onPress={() => {
                  void submitPause();
                }}
                disabled={pausing || !pauseReason}
              >
                {pausing ? (
                  <ActivityIndicator color={colors.buttonText} />
                ) : (
                  <Text style={styles.cancelModalPrimaryText}>Confirm</Text>
                )}
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      <Modal
        visible={cancelVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setCancelVisible(false)}
      >
        <View style={styles.cancelModalOverlay}>
          <View style={styles.cancelModalCard}>
            <Text style={styles.cancelModalTitle}>Cancel task</Text>
            <Text style={styles.cancelModalSubtitle}>Select a reason</Text>
            {(cancelReasons.length > 0
              ? cancelReasons
              : [{ value: 'other', label: 'Other' }]
            ).map((reason) => (
              <Pressable
                key={reason.value}
                style={[
                  styles.cancelReasonRow,
                  cancelReason === reason.value &&
                    styles.cancelReasonRowSelected,
                ]}
                onPress={() => setCancelReason(reason.value)}
              >
                <Text style={styles.cancelReasonText}>{reason.label}</Text>
              </Pressable>
            ))}
            {cancelReason === 'other' ? (
              <TextInput
                style={styles.cancelNoteInput}
                placeholder="Add a note"
                placeholderTextColor={colors.textDisabled}
                value={cancelNote}
                onChangeText={setCancelNote}
                multiline
              />
            ) : null}
            <View style={styles.cancelModalActions}>
              <Pressable
                style={styles.cancelModalSecondary}
                onPress={() => setCancelVisible(false)}
                disabled={cancelling}
              >
                <Text style={styles.cancelModalSecondaryText}>Back</Text>
              </Pressable>
              <Pressable
                style={styles.cancelModalPrimary}
                onPress={() => {
                  void submitCancel();
                }}
                disabled={cancelling || !cancelReason}
              >
                {cancelling ? (
                  <ActivityIndicator color={colors.buttonText} />
                ) : (
                  <Text style={styles.cancelModalPrimaryText}>Confirm</Text>
                )}
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
};

export default TaskMapScreen;
