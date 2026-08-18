import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Image, Pressable, StatusBar, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useFocusEffect } from '@react-navigation/native';
import LinearGradient from 'react-native-linear-gradient';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import { ScreenNames } from '../../constants/ScreenNames';
import { RootStackParamList } from '../../navigation/AppNavigator';
import { useAppTheme } from '../../theme/ThemeContext';
import { useResponsive } from '../../hooks/useResponsive';
import { useAppDispatch, useAppSelector } from '../../store/hooks';
import { fetchProfileAction } from '../../store/actions/authActions';
import {
  loadAttendance,
  syncAttendanceFromServer,
} from '../../services/attendanceStorage';
import { fetchFieldTaskDetail } from '../../services/apiClient';
import { saveTaskProgress } from '../../services/taskProgressStorage';
import { showAlert } from '../../components/common/customAlert/alertService';
import { getAuthErrorMessage } from '../../constants/ApiEndpoints';
import { createStyles } from './HomeScreenStyle';

type Props = NativeStackScreenProps<RootStackParamList, typeof ScreenNames.HOME>;

const getInitials = (name: string) => {
  const parts = name.split(/\s+/).filter(Boolean).slice(0, 2);
  if (parts.length === 0) {
    return '?';
  }
  return parts.map((part) => part[0]?.toUpperCase() ?? '').join('');
};

const HomeScreen = ({ navigation }: Props) => {
  const { colors, isDark } = useAppTheme();
  const { isTablet, contentMaxWidth } = useResponsive();
  const styles = createStyles(colors, isTablet, contentMaxWidth);
  const dispatch = useAppDispatch();

  const employee = useAppSelector((state) => state.auth.employee);
  const accessToken = useAppSelector((state) => state.auth.accessToken);
  const [isCheckedIn, setIsCheckedIn] = useState(false);
  const resumePromptedRef = useRef(false);

  const fullName = employee?.name?.trim() ?? '';
  const avatarUri =
    typeof employee?.avatar === 'string' ? employee.avatar.trim() : '';
  const hasAvatar = avatarUri.length > 0;
  const initials = getInitials(fullName);
  const checkActionLabel = isCheckedIn ? 'Check Out' : 'Check In';

  // Safety net only: login/splash already hydrate employee into Redux.
  useEffect(() => {
    if (!employee) {
      void dispatch(fetchProfileAction());
    }
  }, [dispatch, employee]);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      const sync = accessToken
        ? syncAttendanceFromServer(accessToken)
        : loadAttendance();
      void sync.then(async (attendance) => {
        if (!active) {
          return;
        }
        setIsCheckedIn(attendance.isCheckedIn);

        if (
          !accessToken ||
          !attendance.activeTaskId ||
          resumePromptedRef.current
        ) {
          return;
        }
        resumePromptedRef.current = true;
        const taskId = attendance.activeTaskId;
        const stopId = attendance.activeTaskStopId;
        const state = attendance.activeTaskState;

        showAlert({
          title: 'Resume active task?',
          message: 'You have a task in progress. Open it to continue.',
          confirmText: 'Open',
          cancelText: 'Later',
          onConfirm: () => {
            void (async () => {
              try {
                const detail = await fetchFieldTaskDetail(accessToken, taskId);
                if (
                  typeof detail.stop_id === 'number' &&
                  detail.stop_id > 0
                ) {
                  await saveTaskProgress(taskId, {
                    stop_id: detail.stop_id,
                  });
                }
                const title =
                  (typeof detail.partner_name === 'string' &&
                    detail.partner_name) ||
                  detail.name ||
                  'Task';
                const address =
                  (typeof detail.address === 'string' && detail.address) ||
                  '—';

                if (
                  (state === 'arrived' ||
                    (typeof stopId === 'number' && stopId > 0)) &&
                  (typeof detail.stop_id === 'number' ||
                    typeof stopId === 'number')
                ) {
                  const openStopId =
                    typeof detail.stop_id === 'number'
                      ? detail.stop_id
                      : (stopId as number);
                  navigation.navigate(ScreenNames.TASK_CAPTURE, {
                    taskId,
                    stopId: openStopId,
                    requirements: detail.requirements ?? undefined,
                    title,
                    address,
                  });
                  return;
                }

                navigation.navigate(ScreenNames.TASK_MAP, {
                  taskId,
                  title,
                  address,
                  latitude: detail.latitude,
                  longitude: detail.longitude,
                  distanceKm:
                    typeof detail.distance_km === 'number'
                      ? detail.distance_km
                      : null,
                  status: detail.status,
                });
              } catch (e) {
                const message =
                  e instanceof Error ? e.message : 'task_detail_failed';
                showAlert({
                  title: 'Could not open task',
                  message: getAuthErrorMessage(message),
                });
              }
            })();
          },
        });
      });
      return () => {
        active = false;
      };
    }, [accessToken, navigation]),
  );

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar
        barStyle={isDark ? 'light-content' : 'dark-content'}
        backgroundColor={colors.background}
      />
      <View style={styles.navbar}>
        <View style={styles.navbarLeft}>
          <Pressable
            onPress={() => navigation.navigate(ScreenNames.SETTINGS)}
            accessibilityRole="button"
            accessibilityLabel="Settings"
          >
            {hasAvatar ? (
              <Image source={{ uri: avatarUri }} style={styles.avatar} />
            ) : (
              <LinearGradient
                colors={[...colors.buttonGradient]}
                start={{ x: 0, y: 0 }}
                end={{ x: 0, y: 1 }}
                style={styles.avatar}
              >
                <Text style={styles.avatarInitials}>{initials}</Text>
              </LinearGradient>
            )}
          </Pressable>

          <View style={styles.greetingWrap}>
            <Text style={styles.greeting}>Welcome Back!</Text>
            {fullName ? <Text style={styles.name}>{fullName}</Text> : null}
          </View>
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
        <View>
          <Text style={styles.sectionTitle}>Management Tools</Text>
          <View style={styles.toolsRow}>
            <Pressable
              style={styles.toolCard}
              onPress={() => navigation.navigate(ScreenNames.GEO_MANAGEMENT)}
              accessibilityRole="button"
              accessibilityLabel="Geo"
            >
              <View style={styles.toolIconWrap}>
                <MaterialIcons
                  name="location-on"
                  size={isTablet ? 32 : 28}
                  color={colors.button}
                />
              </View>
              <Text style={styles.toolLabel}>Geo</Text>
            </Pressable>

            <Pressable
              style={styles.toolCard}
              onPress={() =>
                navigation.navigate(ScreenNames.ATTENDANCE_CALENDAR)
              }
              accessibilityRole="button"
              accessibilityLabel="Attendance"
            >
              <View style={styles.toolIconWrap}>
                <MaterialIcons
                  name="badge"
                  size={isTablet ? 32 : 28}
                  color={colors.button}
                />
              </View>
              <Text style={styles.toolLabel}>Attendance</Text>
            </Pressable>

            <Pressable
              style={styles.toolCard}
              onPress={() =>
                navigation.navigate(ScreenNames.TIME_OFF_CALENDAR)
              }
              accessibilityRole="button"
              accessibilityLabel="Time Off"
            >
              <View style={styles.toolIconWrap}>
                <MaterialIcons
                  name="event-busy"
                  size={isTablet ? 32 : 28}
                  color={colors.button}
                />
              </View>
              <Text style={styles.toolLabel}>Time Off</Text>
            </Pressable>
          </View>
        </View>

        <View>
          <Text style={styles.sectionTitle}>Quick Actions</Text>
          <View style={styles.actionsRow}>
            <Pressable
              style={styles.actionItem}
              onPress={() => navigation.navigate(ScreenNames.GEO_HISTORY)}
              accessibilityRole="button"
              accessibilityLabel="Geo History"
            >
              <View style={styles.actionIconWrap}>
                <MaterialIcons
                  name="history"
                  size={isTablet ? 28 : 24}
                  color={colors.button}
                />
              </View>
              <Text style={styles.actionLabel}>Geo History</Text>
            </Pressable>

            <Pressable
              style={styles.actionItem}
              onPress={() => {}}
              accessibilityRole="button"
              accessibilityLabel="Get Help"
            >
              <View style={styles.actionIconWrap}>
                <MaterialIcons
                  name="help-outline"
                  size={isTablet ? 28 : 24}
                  color={colors.button}
                />
              </View>
              <Text style={styles.actionLabel}>Get Help</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </SafeAreaView>
  );
};

export default HomeScreen;
