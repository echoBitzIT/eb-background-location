import { useEffect, useRef, useState } from 'react';
import { ScreenNames } from '../constants/ScreenNames';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useAppSelector } from '../store/hooks';
import { useAppTheme } from '../theme/ThemeContext';
import {
  DarkTheme,
  DefaultTheme,
  NavigationContainer,
  type NavigationContainerRef,
  type NavigationState,
  type PartialState,
} from '@react-navigation/native';
import SplashScreen from '../screens/splashScreen/SplashScreen';
import FetchUrlScreen from '../screens/fetchUrlScreen/FetchUrlScreen';
import LoginScreen from '../screens/loginScreen/LoginScreen';
import HomeScreen from '../screens/homeScreen/HomeScreen';
import SettingsScreen from '../screens/settingsScreen/SettingsScreen';
import ProfileScreen from '../screens/profileScreen/ProfileScreen';
import CheckInScreen from '../screens/checkInScreen/CheckInScreen';
import SelfieCameraScreen from '../screens/selfieCameraScreen/SelfieCameraScreen';
import GeoManagementScreen from '../screens/geoManagementScreen/GeoManagementScreen';
import GeoHistoryScreen from '../screens/geoHistoryScreen/GeoHistoryScreen';
import GeoHistoryDayScreen from '../screens/geoHistoryDayScreen/GeoHistoryDayScreen';
import GeoHistoryMapScreen from '../screens/geoHistoryMapScreen/GeoHistoryMapScreen';
import GeoHistorySessionScreen from '../screens/geoHistorySessionScreen/GeoHistorySessionScreen';
import GeoHistoryTaskDetailScreen from '../screens/geoHistoryTaskDetailScreen/GeoHistoryTaskDetailScreen';
import AttendanceCalendarScreen from '../screens/attendanceCalendarScreen/AttendanceCalendarScreen';
import TimeOffCalendarScreen from '../screens/timeOffCalendarScreen/TimeOffCalendarScreen';
import TimeOffRequestScreen from '../screens/timeOffRequestScreen/TimeOffRequestScreen';
import DefaultRouteScreen from '../screens/defaultRouteScreen/DefaultRouteScreen';
import TaskRoutingScreen from '../screens/taskRoutingScreen/TaskRoutingScreen';
import WhatNeedsToBeDoneScreen from '../screens/whatNeedsToBeDoneScreen/WhatNeedsToBeDoneScreen';
import TaskMapScreen from '../screens/taskMapScreen/TaskMapScreen';
import TaskCaptureScreen from '../screens/taskCaptureScreen/TaskCaptureScreen';
import ViewDetailsScreen from '../screens/viewDetailsScreen/ViewDetailsScreen';
import { useAccessGateMonitor } from '../hooks/useAccessGateMonitor';
import type { FieldTaskRequirements } from '../services/apiClient';
import { attachPushNotificationHandlers } from '../services/pushNotificationService';

export type RootStackParamList = {
  [ScreenNames.SPLASH]: undefined;
  [ScreenNames.FETCH_URL]: undefined;
  [ScreenNames.LOGIN]: undefined;
  [ScreenNames.HOME]: undefined;
  [ScreenNames.SETTINGS]: undefined;
  [ScreenNames.PROFILE]: undefined;
  [ScreenNames.CHECK_IN]: { selfiePath?: string } | undefined;
  [ScreenNames.SELFIE_CAMERA]:
    | { returnTo?: 'checkIn' | 'visitStop' }
    | undefined;
  [ScreenNames.GEO_MANAGEMENT]: undefined;
  [ScreenNames.GEO_HISTORY]: undefined;
  [ScreenNames.GEO_HISTORY_DAY]: { date: string };
  [ScreenNames.GEO_HISTORY_MAP]: {
    sessionId: number;
    taskId: number;
    taskName?: string;
  };
  [ScreenNames.GEO_HISTORY_SESSION]: {
    sessionId: number;
    sessionName?: string;
  };
  [ScreenNames.GEO_HISTORY_TASK_DETAIL]: {
    taskId: number;
    stopId?: number;
    sessionId?: number;
  };
  [ScreenNames.ATTENDANCE_CALENDAR]: undefined;
  [ScreenNames.TIME_OFF_CALENDAR]: undefined;
  [ScreenNames.TIME_OFF_REQUEST]: undefined;
  [ScreenNames.DEFAULT_ROUTE]: undefined;
  [ScreenNames.TASK_ROUTING]: undefined;
  [ScreenNames.WHAT_NEEDS_TO_BE_DONE]: { taskId: number };
  [ScreenNames.TASK_MAP]: {
    taskId: number;
    title: string;
    address: string;
    latitude: number;
    longitude: number;
    distanceKm?: number | null;
    status?: string;
    isUpcoming?: boolean;
  };
  [ScreenNames.TASK_CAPTURE]: {
    taskId: number;
    stopId: number;
    requirements?: FieldTaskRequirements;
    title?: string;
    address?: string;
  };
  [ScreenNames.VIEW_DETAILS]:
    | { photoPath?: string; visitNote?: string }
    | undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();

function getFocusedRouteName(
  state?: NavigationState | PartialState<NavigationState>,
): string | undefined {
  if (!state || state.index == null || !state.routes?.length) {
    return undefined;
  }
  return state.routes[state.index]?.name;
}

const AppNavigator = () => {
  const { colors, isDark } = useAppTheme();
  const sessionHydrated = useAppSelector((state) => state.auth.sessionHydrated);
  const accessToken = useAppSelector((state) => state.auth.accessToken);
  const navigationRef =
    useRef<NavigationContainerRef<RootStackParamList>>(null);
  const stackKey = !sessionHydrated ? 'splash' : accessToken ? 'app' : 'auth';
  const initialRouteName = !sessionHydrated
    ? ScreenNames.SPLASH
    : accessToken
      ? ScreenNames.HOME
      : ScreenNames.FETCH_URL;
  const [routeName, setRouteName] = useState<string | undefined>(
    initialRouteName,
  );

  useEffect(() => {
    setRouteName(initialRouteName);
  }, [stackKey, initialRouteName]);

  const syncRouteName = (
    state?: NavigationState | PartialState<NavigationState>,
  ) => {
    const name = getFocusedRouteName(state);
    if (name) {
      setRouteName(name);
    }
  };

  useAccessGateMonitor({
    enabled: routeName !== undefined && routeName !== ScreenNames.SPLASH,
  });

  const navTheme = {
    ...(isDark ? DarkTheme : DefaultTheme),
    colors: {
      ...(isDark ? DarkTheme.colors : DefaultTheme.colors),
      background: colors.background,
      card: colors.background,
      text: colors.textEnabled,
      primary: colors.button,
    },
  };

  return (
    <NavigationContainer
      ref={navigationRef}
      theme={navTheme}
      onReady={() => {
        syncRouteName(navigationRef.current?.getRootState());
        attachPushNotificationHandlers();
      }}
      onStateChange={syncRouteName}>
      <Stack.Navigator
        key={stackKey}
        initialRouteName={initialRouteName}
        screenOptions={{ headerShown: false }}>
        {!sessionHydrated ? (
          <Stack.Screen name={ScreenNames.SPLASH} component={SplashScreen} />
        ) : accessToken ? (
          <>
            <Stack.Screen name={ScreenNames.HOME} component={HomeScreen} />
            <Stack.Screen
              name={ScreenNames.SETTINGS}
              component={SettingsScreen}
            />
            <Stack.Screen
              name={ScreenNames.PROFILE}
              component={ProfileScreen}
            />
            <Stack.Screen
              name={ScreenNames.CHECK_IN}
              component={CheckInScreen}
            />
            <Stack.Screen
              name={ScreenNames.SELFIE_CAMERA}
              component={SelfieCameraScreen}
            />
            <Stack.Screen
              name={ScreenNames.GEO_MANAGEMENT}
              component={GeoManagementScreen}
            />
            <Stack.Screen
              name={ScreenNames.GEO_HISTORY}
              component={GeoHistoryScreen}
            />
            <Stack.Screen
              name={ScreenNames.GEO_HISTORY_DAY}
              component={GeoHistoryDayScreen}
            />
            <Stack.Screen
              name={ScreenNames.GEO_HISTORY_MAP}
              component={GeoHistoryMapScreen}
            />
            <Stack.Screen
              name={ScreenNames.GEO_HISTORY_SESSION}
              component={GeoHistorySessionScreen}
            />
            <Stack.Screen
              name={ScreenNames.GEO_HISTORY_TASK_DETAIL}
              component={GeoHistoryTaskDetailScreen}
            />
            <Stack.Screen
              name={ScreenNames.ATTENDANCE_CALENDAR}
              component={AttendanceCalendarScreen}
            />
            <Stack.Screen
              name={ScreenNames.TIME_OFF_CALENDAR}
              component={TimeOffCalendarScreen}
            />
            <Stack.Screen
              name={ScreenNames.TIME_OFF_REQUEST}
              component={TimeOffRequestScreen}
            />
            <Stack.Screen
              name={ScreenNames.DEFAULT_ROUTE}
              component={DefaultRouteScreen}
            />
            <Stack.Screen
              name={ScreenNames.TASK_ROUTING}
              component={TaskRoutingScreen}
            />
            <Stack.Screen
              name={ScreenNames.WHAT_NEEDS_TO_BE_DONE}
              component={WhatNeedsToBeDoneScreen}
            />
            <Stack.Screen
              name={ScreenNames.TASK_MAP}
              component={TaskMapScreen}
            />
            <Stack.Screen
              name={ScreenNames.TASK_CAPTURE}
              component={TaskCaptureScreen}
            />
            <Stack.Screen
              name={ScreenNames.VIEW_DETAILS}
              component={ViewDetailsScreen}
            />
          </>
        ) : (
          <>
            <Stack.Screen
              name={ScreenNames.FETCH_URL}
              component={FetchUrlScreen}
            />
            <Stack.Screen name={ScreenNames.LOGIN} component={LoginScreen} />
          </>
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
};

export default AppNavigator;
