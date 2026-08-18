import React, { useCallback, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StatusBar,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useFocusEffect } from '@react-navigation/native';
import LinearGradient from 'react-native-linear-gradient';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import { showAlert } from '../../components/common/customAlert/alertService';
import { getAuthErrorMessage } from '../../constants/ApiEndpoints';
import { ScreenNames } from '../../constants/ScreenNames';
import { RootStackParamList } from '../../navigation/AppNavigator';
import {
  fieldEndSession,
  fieldStartSession,
} from '../../services/apiClient';
import type {
  FieldEndSessionPayload,
  FieldStartSessionPayload,
} from '../../services/apiClient';
import {
  loadAttendance,
  markTrackingActive,
  markTrackingInactive,
  syncAttendanceFromServer,
} from '../../services/attendanceStorage';
import {
  startLocationTracking,
  stopLocationTracking,
} from '../../services/locationTrackingService';
import { useAppSelector } from '../../store/hooks';
import { useAppTheme } from '../../theme/ThemeContext';
import { useResponsive } from '../../hooks/useResponsive';
import { getCurrentCoordinates } from '../../utils/locationGate';
import { createPointUuid } from '../../utils/pointUuid';
import { createStyles } from './DefaultRouteScreenStyle';

type Props = NativeStackScreenProps<
  RootStackParamList,
  typeof ScreenNames.DEFAULT_ROUTE
>;

const DefaultRouteScreen = ({ navigation }: Props) => {
  const { colors, isDark } = useAppTheme();
  const { isTablet, contentMaxWidth } = useResponsive();
  const styles = createStyles(colors, isTablet, contentMaxWidth);
  const accessToken = useAppSelector((state) => state.auth.accessToken);
  const [isSessionActive, setIsSessionActive] = useState(false);
  const [isCheckedIn, setIsCheckedIn] = useState(false);
  const [hydrating, setHydrating] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const submittingRef = useRef(false);
  const checkActionLabel = isCheckedIn ? 'Check Out' : 'Check In';

  useFocusEffect(
    useCallback(() => {
      let active = true;

      const hydrate = async () => {
        const local = await loadAttendance();
        if (!active) {
          return;
        }

        setIsCheckedIn(local.isCheckedIn);
        setIsSessionActive(local.isTrackingActive);
        setHydrating(false);

        if (!accessToken) {
          return;
        }

        const synced = await syncAttendanceFromServer(accessToken);
        if (!active) {
          return;
        }

        setIsCheckedIn(synced.isCheckedIn);
        setIsSessionActive(synced.isTrackingActive);
      };

      void hydrate();
      return () => {
        active = false;
      };
    }, [accessToken]),
  );

  const handleStartSession = useCallback(async () => {
    if (submittingRef.current) {
      return;
    }
    if (!accessToken) {
      showAlert({
        title: 'Session expired',
        message: 'Please log in again.',
      });
      return;
    }

    submittingRef.current = true;
    setSubmitting(true);

    try {
      const coords = await getCurrentCoordinates();
      const payload: FieldStartSessionPayload = {
        point_uuid: createPointUuid(),
        latitude: coords.latitude,
        longitude: coords.longitude,
      };
      if (coords.accuracy != null) {
        payload.accuracy = coords.accuracy;
      }

      const result = await fieldStartSession(accessToken, payload);
      await startLocationTracking(accessToken);

      const checkInAt =
        typeof result.checkin_datetime === 'string'
          ? result.checkin_datetime
          : new Date().toISOString();
      await markTrackingActive({
        attendanceId: result.attendance_id,
        trackingSessionId: result.session_id,
        checkInAt,
      });

      setIsSessionActive(true);
      setIsCheckedIn(true);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'start_session_failed';
      showAlert({
        title: 'Start session failed',
        message: getAuthErrorMessage(message),
      });
    } finally {
      submittingRef.current = false;
      setSubmitting(false);
    }
  }, [accessToken]);

  const handleStopSession = useCallback(async () => {
    if (submittingRef.current) {
      return;
    }
    if (!accessToken) {
      showAlert({
        title: 'Session expired',
        message: 'Please log in again.',
      });
      return;
    }

    submittingRef.current = true;
    setSubmitting(true);

    try {
      const payload: FieldEndSessionPayload = {};
      try {
        const coords = await getCurrentCoordinates();
        payload.point_uuid = createPointUuid();
        payload.latitude = coords.latitude;
        payload.longitude = coords.longitude;
        if (coords.accuracy != null) {
          payload.accuracy = coords.accuracy;
        }
      } catch {
        // GPS is optional for end-session; continue without a final point.
      }

      await fieldEndSession(accessToken, payload);
      await stopLocationTracking();

      const local = await loadAttendance();
      await markTrackingInactive(local);

      setIsSessionActive(false);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'end_session_failed';
      showAlert({
        title: 'Stop session failed',
        message: getAuthErrorMessage(message),
      });
    } finally {
      submittingRef.current = false;
      setSubmitting(false);
    }
  }, [accessToken]);

  const handlePrimaryAction = useCallback(() => {
    if (isSessionActive) {
      void handleStopSession();
    } else {
      void handleStartSession();
    }
  }, [handleStartSession, handleStopSession, isSessionActive]);

  const headline = isSessionActive ? 'Session Started' : 'Ready to Go?';
  const subtitle = isSessionActive
    ? "You're online and ready to accept ride requests."
    : 'Start your session and begin accepting ride requests.';
  const actionLabel = isSessionActive ? 'Stop Session' : 'Start Session';
  const actionIcon = isSessionActive ? 'block' : 'touch-app';

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar
        barStyle={isDark ? 'light-content' : 'dark-content'}
        backgroundColor={colors.background}
      />
      <View style={styles.header}>
        <View style={styles.headerLeft}>
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
            Default Route
          </Text>
        </View>
        <Pressable
          onPress={() => navigation.navigate(ScreenNames.CHECK_IN)}
          accessibilityRole="button"
          accessibilityLabel={checkActionLabel}
        >
          <LinearGradient
            colors={[...colors.buttonGradient]}
            start={{ x: 0, y: 0 }}
            end={{ x: 0, y: 1 }}
            style={styles.checkInButton}
          >
            <Text style={styles.checkInText}>{checkActionLabel}</Text>
          </LinearGradient>
        </Pressable>
      </View>

      <View style={styles.content}>
        <View style={styles.topSection}>
          <Text style={styles.headline}>{headline}</Text>
          <Text style={styles.subtitle}>{subtitle}</Text>
        </View>

        <View style={styles.middleSection}>
          <Pressable
            style={styles.sessionButton}
            onPress={handlePrimaryAction}
            disabled={submitting || hydrating}
            accessibilityRole="button"
            accessibilityLabel={actionLabel}
            accessibilityState={{ disabled: submitting || hydrating }}
          >
            <LinearGradient
              colors={[...colors.buttonGradient]}
              start={{ x: 0, y: 0 }}
              end={{ x: 0, y: 1 }}
              style={styles.sessionGradient}
            >
              {submitting || hydrating ? (
                <ActivityIndicator color={colors.buttonText} size="large" />
              ) : (
                <>
                  <MaterialIcons
                    name={actionIcon}
                    size={isTablet ? 48 : 40}
                    color={colors.buttonText}
                  />
                  <Text style={styles.sessionLabel}>{actionLabel}</Text>
                </>
              )}
            </LinearGradient>
          </Pressable>
        </View>

        <View style={styles.bottomSection}>
          {isSessionActive ? (
            <Pressable
              style={styles.destinationButton}
              onPress={() => navigation.navigate(ScreenNames.VIEW_DETAILS)}
              accessibilityRole="button"
              accessibilityLabel="Reach at Destination"
            >
              <MaterialIcons
                name="near-me"
                size={isTablet ? 22 : 20}
                color={colors.textEnabled}
              />
              <Text style={styles.destinationText}>Reach at Destination</Text>
            </Pressable>
          ) : null}
        </View>
      </View>
    </SafeAreaView>
  );
};

export default DefaultRouteScreen;
