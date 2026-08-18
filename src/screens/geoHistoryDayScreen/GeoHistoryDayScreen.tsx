import React, { useEffect, useMemo, useState } from 'react';
import {
  FlatList,
  Pressable,
  StatusBar,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import { getAuthErrorMessage } from '../../constants/ApiEndpoints';
import { ScreenNames } from '../../constants/ScreenNames';
import { RootStackParamList } from '../../navigation/AppNavigator';
import {
  fetchFieldHistorySessions,
  isRequestCanceled,
  type FieldHistorySession,
} from '../../services/apiClient';
import { useAppSelector } from '../../store/hooks';
import { useAppTheme } from '../../theme/ThemeContext';
import { useResponsive } from '../../hooks/useResponsive';
import { SessionListSkeleton } from '../../components/common/skeleton/ScreenSkeletons';
import { createStyles } from './GeoHistoryDayScreenStyle';

type Props = NativeStackScreenProps<
  RootStackParamList,
  typeof ScreenNames.GEO_HISTORY_DAY
>;

const MONTHS_SHORT = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
] as const;

function parseDateKey(key: string) {
  const [year, month, day] = key.split('-').map(Number);
  return new Date(year, month - 1, day);
}

function formatHeaderDate(key: string) {
  const date = parseDateKey(key);
  return `${date.getDate()} ${MONTHS_SHORT[date.getMonth()]} ${date.getFullYear()}`;
}

/** API datetimes are UTC `YYYY-MM-DD HH:MM:SS` — show HH:MM for cards. */
function formatClock(value: string | false) {
  if (!value) {
    return '—';
  }
  const parts = value.split(' ');
  const time = parts[1];
  if (!time) {
    return '—';
  }
  return time.slice(0, 5);
}

function formatStat(value: number, unit: string) {
  const rounded = Number.isInteger(value) ? String(value) : value.toFixed(1);
  return `${rounded} ${unit}`;
}

const GeoHistoryDayScreen = ({ navigation, route }: Props) => {
  const { colors, isDark } = useAppTheme();
  const { isTablet, contentMaxWidth } = useResponsive();
  const styles = createStyles(colors, isTablet, contentMaxWidth, isDark);
  const accessToken = useAppSelector((state) => state.auth.accessToken);
  const { date } = route.params;

  const [sessions, setSessions] = useState<FieldHistorySession[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const headerTitle = useMemo(() => formatHeaderDate(date), [date]);
  const iconSize = isTablet ? 26 : 22;

  useEffect(() => {
    if (!accessToken) {
      setError('Session expired. Please log in again.');
      setSessions([]);
      setLoading(false);
      return;
    }

    const controller = new AbortController();
    setLoading(true);
    setError(null);

    (async () => {
      try {
        const result = await fetchFieldHistorySessions(
          accessToken,
          { from: date, to: date, limit: 50, offset: 0 },
          { signal: controller.signal },
        );
        if (controller.signal.aborted) {
          return;
        }
        setSessions(result.sessions);
      } catch (e) {
        if (controller.signal.aborted || isRequestCanceled(e)) {
          return;
        }
        const message =
          e instanceof Error ? e.message : 'history_sessions_failed';
        setError(getAuthErrorMessage(message));
        setSessions([]);
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      }
    })();

    return () => {
      controller.abort();
    };
  }, [accessToken, date]);

  const renderSessionCard = ({ item }: { item: FieldHistorySession }) => {
    return (
      <Pressable
        style={styles.sessionCard}
        onPress={() =>
          navigation.navigate(ScreenNames.GEO_HISTORY_SESSION, {
            sessionId: item.session_id,
            sessionName: item.name,
          })
        }
        accessibilityRole="button"
        accessibilityLabel={`Session ${item.name}`}
      >
        <View style={styles.sessionCardBody}>
          <View style={styles.sessionHeader}>
            <View style={styles.sessionTitleBlock}>
              <Text style={styles.sessionName}>{item.name}</Text>
              <Text style={styles.sessionState}>{item.state}</Text>
            </View>
          </View>

          <View style={styles.timeRow}>
            <View style={styles.timeColumn}>
              <Text style={styles.timeLabel}>Start</Text>
              <Text style={styles.timeValue}>
                {formatClock(item.checkin_datetime)}
              </Text>
            </View>
            <View style={styles.timeDivider} />
            <View style={styles.timeColumn}>
              <Text style={styles.timeLabel}>End</Text>
              <Text style={styles.timeValue}>
                {formatClock(item.checkout_datetime)}
              </Text>
            </View>
          </View>

          <View style={styles.metaRow}>
            <Text style={styles.metaItem}>
              {formatStat(item.tracking_duration_hours, 'hrs')}
            </Text>
            <Text style={styles.metaItem}>
              {formatStat(item.total_distance_km, 'km')}
            </Text>
            <Text style={styles.metaItem}>
              {item.stop_count} {item.stop_count === 1 ? 'stop' : 'stops'}
            </Text>
            <Text style={styles.metaItem}>
              {item.task_count} {item.task_count === 1 ? 'task' : 'tasks'}
            </Text>
          </View>
        </View>

        <MaterialIcons
          name="chevron-right"
          size={isTablet ? 28 : 24}
          color={colors.textDisabled}
        />
      </Pressable>
    );
  };

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

      <View style={styles.content}>
        {error ? <Text style={styles.emptyListText}>{error}</Text> : null}

        {loading && sessions.length === 0 ? (
          <SessionListSkeleton />
        ) : (
          <FlatList
            style={styles.sessionList}
            contentContainerStyle={styles.sessionListContent}
            data={sessions}
            keyExtractor={(item) => String(item.session_id)}
            renderItem={renderSessionCard}
            showsVerticalScrollIndicator={false}
            ListEmptyComponent={
              error ? null : (
                <Text style={styles.emptyListText}>
                  No sessions for {headerTitle}
                </Text>
              )
            }
          />
        )}
      </View>
    </SafeAreaView>
  );
};

export default GeoHistoryDayScreen;
