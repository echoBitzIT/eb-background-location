import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Image,
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
import { showToast } from '../../components/common/customToast/toastService';
import { ScreenNames } from '../../constants/ScreenNames';
import { getAuthErrorMessage } from '../../constants/ApiEndpoints';
import { RootStackParamList } from '../../navigation/AppNavigator';
import { popToScreen } from '../../navigation/popToScreen';
import { useAppTheme } from '../../theme/ThemeContext';
import { useResponsive } from '../../hooks/useResponsive';
import { useAppSelector } from '../../store/hooks';
import { isCameraReady } from '../../utils/cameraGate';
import { compressSelfieToBase64 } from '../../utils/compressSelfie';
import {
  fieldCheckIn,
  fieldCheckOut,
} from '../../services/apiClient';
import {
  loadAttendance,
  markCheckedIn,
  markCheckedOut,
  syncAttendanceFromServer,
  type PersistedAttendance,
} from '../../services/attendanceStorage';
import { stopLocationTracking } from '../../services/locationTrackingService';
import { createStyles } from './CheckInScreenStyle';

type Props = NativeStackScreenProps<
  RootStackParamList,
  typeof ScreenNames.CHECK_IN
>;

function isAlreadyActiveSessionError(message: string): boolean {
  return /already has an active/i.test(message);
}

const WEEKDAYS = [
  'Sunday',
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
] as const;

const MONTHS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
] as const;

function pad2(value: number) {
  return value.toString().padStart(2, '0');
}

function formatClock(now: Date) {
  return {
    time: `${pad2(now.getHours())}:${pad2(now.getMinutes())}`,
    date: `${WEEKDAYS[now.getDay()]} | ${MONTHS[now.getMonth()]} ${pad2(now.getDate())}`,
  };
}

function toFileUri(path: string) {
  return path.startsWith('file://') ? path : `file://${path}`;
}

/** Format Odoo/ISO datetime for summary HH:MM display. */
function formatTimeLabel(value: string | null | undefined): string {
  if (!value) {
    return '00:00';
  }
  const normalized = value.includes('T') ? value : value.replace(' ', 'T');
  const date = new Date(normalized.endsWith('Z') ? normalized : `${normalized}Z`);
  if (Number.isNaN(date.getTime())) {
    const match = value.match(/(\d{2}):(\d{2})/);
    return match ? `${match[1]}:${match[2]}` : '00:00';
  }
  return `${pad2(date.getHours())}:${pad2(date.getMinutes())}`;
}

function formatTotalHours(
  checkInAt: string | null,
  checkOutAt: string | null,
  isCheckedIn: boolean,
): string {
  if (!checkInAt) {
    return '00:00';
  }
  const startRaw = checkInAt.includes('T')
    ? checkInAt
    : checkInAt.replace(' ', 'T');
  const start = new Date(
    startRaw.endsWith('Z') ? startRaw : `${startRaw}Z`,
  ).getTime();
  if (Number.isNaN(start)) {
    return '00:00';
  }
  let end = Date.now();
  if (checkOutAt && !isCheckedIn) {
    const endRaw = checkOutAt.includes('T')
      ? checkOutAt
      : checkOutAt.replace(' ', 'T');
    const parsed = new Date(
      endRaw.endsWith('Z') ? endRaw : `${endRaw}Z`,
    ).getTime();
    if (!Number.isNaN(parsed)) {
      end = parsed;
    }
  }
  const minutes = Math.max(0, Math.floor((end - start) / 60000));
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return `${pad2(hours)}:${pad2(mins)}`;
}

const CheckInScreen = ({ navigation, route }: Props) => {
  const { colors, isDark } = useAppTheme();
  const { isTablet, contentMaxWidth } = useResponsive();
  const styles = createStyles(colors, isTablet, contentMaxWidth);

  const employee = useAppSelector((state) => state.auth.employee);
  const accessToken = useAppSelector((state) => state.auth.accessToken);
  const firstName = employee?.name?.trim().split(/\s+/)[0] ?? '';
  const jobTitle =
    typeof employee?.job_title === 'string' ? employee.job_title.trim() : '';

  const [now, setNow] = useState(() => new Date());
  const [selfiePath, setSelfiePath] = useState<string | null>(
    route.params?.selfiePath ?? null,
  );
  const [openingCamera, setOpeningCamera] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [attendance, setAttendance] = useState<PersistedAttendance>({
    isCheckedIn: false,
    sessionId: null,
    trackingSessionId: null,
    isTrackingActive: false,
    checkInAt: null,
    checkOutAt: null,
    activeTaskId: null,
    activeTaskState: null,
    activeTaskStopId: null,
  });
  const [attendanceReady, setAttendanceReady] = useState(false);
 

  const lastSubmittedSelfieRef = useRef<string | null>(null);
  const submittingRef = useRef(false);

  useEffect(() => {
    const timer = setInterval(() => {
      setNow(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  useFocusEffect(
    useCallback(() => {
      let active = true;

      const hydrate = async () => {
        const local = await loadAttendance();
        if (!active) {
          return;
        }
        // Keep existing readiness — do not reset to false on every focus (selfie race).
        setAttendance(local);
        setAttendanceReady(true);

        if (!accessToken) {
          return;
        }

        const synced = await syncAttendanceFromServer(accessToken);
        if (!active) {
          return;
        }
        setAttendance(synced);
      };

      void hydrate();
      return () => {
        active = false;
      };
    }, [accessToken]),
  );

  const submitWithSelfie = useCallback(
    async (path: string) => {
      if (submittingRef.current || lastSubmittedSelfieRef.current === path) {
        return;
      }
      if (!accessToken) {
        showAlert({
          title: 'Session expired',
          message: 'Please log in again.',
        });
        return;
      }

      // Consume this selfie path immediately so effect/callback churn cannot re-submit.
      lastSubmittedSelfieRef.current = path;
      submittingRef.current = true;
      setSubmitting(true);
      // Clear route param so useEffect cannot re-fire for the same selfie.
      navigation.setParams({ selfiePath: undefined });

      // Prefer TTL-cached sync; parallelize with selfie compress.
      let latest: PersistedAttendance = {
        isCheckedIn: false,
        sessionId: null,
        trackingSessionId: null,
        isTrackingActive: false,
        checkInAt: null,
        checkOutAt: null,
        activeTaskId: null,
        activeTaskState: null,
        activeTaskStopId: null,
      };

      try {
        const [synced, imageBase64] = await Promise.all([
          syncAttendanceFromServer(accessToken),
          compressSelfieToBase64(path),
        ]);
        latest = synced;
        setAttendance(latest);

        if (latest.isCheckedIn) {
          const result = await fieldCheckOut(accessToken, {
            checkout_image: imageBase64,
          });
          const next = await markCheckedOut({
            sessionId:
              typeof result.session_id === 'number'
                ? result.session_id
                : result.attendance_id,
            checkInAt: result.check_in || latest.checkInAt,
            checkOutAt: result.check_out,
          });
          setAttendance(next);
          await stopLocationTracking();
          showToast({ message: 'Check-out successful', durationMs: 3500 });
          popToScreen(navigation, ScreenNames.HOME);
        } else {
          const result = await fieldCheckIn(accessToken, {
            attendance_mode: 'field',
            checkin_image: imageBase64,
          });
          const next = await markCheckedIn({
            attendanceId: result.attendance_id,
            checkInAt: result.check_in,
          });
          setAttendance(next);
          showToast({ message: 'Check-in successful', durationMs: 3500 });
          popToScreen(navigation, ScreenNames.HOME);
        }
      } catch (error) {
        const message =
          error instanceof Error ? error.message : 'check_in_failed';
        if (!latest.isCheckedIn && isAlreadyActiveSessionError(message)) {
          const synced = await syncAttendanceFromServer(accessToken, {
            force: true,
          });
          setAttendance(synced);
          showAlert({
            title: 'Already checked in',
            message: 'Your field session is already active. Use Check Out when you are done.',
          });
          return;
        }
        showAlert({
          title: latest.isCheckedIn ? 'Check-out failed' : 'Check-in failed',
          message: getAuthErrorMessage(message),
        });
      } finally {
        submittingRef.current = false;
        setSubmitting(false);
      }
    },
    [accessToken, navigation],
  );

  useEffect(() => {
    const path = route.params?.selfiePath;
    if (!path) {
      return;
    }
    setSelfiePath(path);
    if (!attendanceReady) {
      return;
    }
    void submitWithSelfie(path);
  }, [route.params?.selfiePath, attendanceReady, submitWithSelfie]);

  const { time, date } = useMemo(() => formatClock(now), [now]);

  const actionLabel = attendance.isCheckedIn ? 'Check out' : 'Check in';
  const headerTitle = attendance.isCheckedIn ? 'Check Out' : 'Check In';

  const handlePrimaryAction = useCallback(async () => {
    if (openingCamera || submitting || !attendanceReady) {
      return;
    }
    setOpeningCamera(true);
    try {
      const ready = await isCameraReady();
      if (!ready) {
        showAlert({
          title: 'Camera Required',
          message: `Please allow camera access to ${actionLabel.toLowerCase()}.`,
        });
        return;
      }
      lastSubmittedSelfieRef.current = null;
      navigation.navigate(ScreenNames.SELFIE_CAMERA);
    } finally {
      setOpeningCamera(false);
    }
  }, [
    actionLabel,
    attendance.isCheckedIn,
    attendanceReady,
    navigation,
    openingCamera,
    submitting,
  ]);

  const checkInLabel = formatTimeLabel(attendance.checkInAt);
  const checkOutLabel = formatTimeLabel(attendance.checkOutAt);
  const totalLabel = formatTotalHours(
    attendance.checkInAt,
    attendance.checkOutAt,
    attendance.isCheckedIn,
  );

  const busy = openingCamera || submitting || !attendanceReady;

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar
        translucent
        barStyle={isDark ? 'light-content' : 'dark-content'}
        backgroundColor="transparent"
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
        <Text style={styles.headerTitle}>{headerTitle}</Text>
      </View>

      <View style={styles.content}>
        <View style={styles.topSection}>
          <Text style={styles.greeting}>
            {firstName ? `Welcome, ${firstName}` : 'Welcome'}
          </Text>
          {jobTitle ? <Text style={styles.jobTitle}>{jobTitle}</Text> : null}
          <Text style={styles.time}>{time}</Text>
          <Text style={styles.date}>{date}</Text>
        </View>

        <View style={styles.middleSection}>
          <View style={styles.checkInWrap}>
            <Pressable
              style={styles.checkInButton}
              onPress={() => void handlePrimaryAction()}
              disabled={busy}
              accessibilityRole="button"
              accessibilityLabel={actionLabel}
            >
              <LinearGradient
                colors={[...colors.buttonGradient]}
                start={{ x: 0, y: 0 }}
                end={{ x: 0, y: 1 }}
                style={styles.checkInGradient}
              >
                {busy ? (
                  <ActivityIndicator color={colors.buttonText} size="large" />
                ) : (
                  <>
                    <MaterialIcons
                      name={
                        attendance.isCheckedIn ? 'logout' : 'touch-app'
                      }
                      size={isTablet ? 48 : 40}
                      color={colors.buttonText}
                    />
                    <Text style={styles.checkInLabel}>{actionLabel}</Text>
                  </>
                )}
              </LinearGradient>
            </Pressable>
          </View>

          {selfiePath ? (
            <View style={styles.selfieChip}>
              <Image
                source={{ uri: toFileUri(selfiePath) }}
                style={styles.selfieThumb}
              />
              <Text style={styles.selfieLabel}>
                {submitting ? 'Submitting…' : 'Selfie captured'}
              </Text>
            </View>
          ) : null}
        </View>

        <View style={styles.summaryCard}>
          <View style={styles.summaryItem}>
            <MaterialIcons
              name="file-download"
              size={isTablet ? 28 : 24}
              color={colors.button}
            />
            <Text style={styles.summaryValue}>{checkInLabel}</Text>
            <Text style={styles.summaryLabel}>Check in</Text>
          </View>
          <View style={styles.summaryItem}>
            <MaterialIcons
              name="file-upload"
              size={isTablet ? 28 : 24}
              color={colors.button}
            />
            <Text style={styles.summaryValue}>{checkOutLabel}</Text>
            <Text style={styles.summaryLabel}>Check out</Text>
          </View>
          <View style={styles.summaryItem}>
            <MaterialIcons
              name="schedule"
              size={isTablet ? 28 : 24}
              color={colors.button}
            />
            <Text style={styles.summaryValue}>{totalLabel}</Text>
            <Text style={styles.summaryLabel}>Total hours</Text>
          </View>
        </View>
      </View>
    </SafeAreaView>
  );
};

export default CheckInScreen;
