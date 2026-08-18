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
  fetchFieldSessionDetail,
  isRequestCanceled,
  type FieldSessionDetail,
  type FieldTask,
} from '../../services/apiClient';
import { useAppSelector } from '../../store/hooks';
import { useAppTheme } from '../../theme/ThemeContext';
import { useResponsive } from '../../hooks/useResponsive';
import { SessionDetailSkeleton } from '../../components/common/skeleton/ScreenSkeletons';
import { createStyles } from './GeoHistorySessionScreenStyle';

type Props = NativeStackScreenProps<
  RootStackParamList,
  typeof ScreenNames.GEO_HISTORY_SESSION
>;

function formatStat(value: number, unit: string) {
  const rounded = Number.isInteger(value) ? String(value) : value.toFixed(1);
  return `${rounded} ${unit}`;
}

const GeoHistorySessionScreen = ({ navigation, route }: Props) => {
  const { colors, isDark } = useAppTheme();
  const { isTablet, contentMaxWidth } = useResponsive();
  const styles = createStyles(colors, isTablet, contentMaxWidth, isDark);
  const accessToken = useAppSelector((state) => state.auth.accessToken);
  const { sessionId, sessionName } = route.params;

  const [detail, setDetail] = useState<FieldSessionDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const iconSize = isTablet ? 26 : 22;

  const headerTitle = useMemo(() => {
    if (detail?.name) {
      return detail.name;
    }
    if (typeof sessionName === 'string' && sessionName.trim()) {
      return sessionName.trim();
    }
    return 'Session';
  }, [detail?.name, sessionName]);

  useEffect(() => {
    if (!accessToken) {
      setError('Session expired. Please log in again.');
      setDetail(null);
      setLoading(false);
      return;
    }

    const controller = new AbortController();
    setLoading(true);
    setError(null);

    (async () => {
      try {
        const result = await fetchFieldSessionDetail(accessToken, sessionId, {
          signal: controller.signal,
        });
        if (controller.signal.aborted) {
          return;
        }
        setDetail(result);
      } catch (e) {
        if (controller.signal.aborted || isRequestCanceled(e)) {
          return;
        }
        const message =
          e instanceof Error ? e.message : 'session_detail_failed';
        setError(getAuthErrorMessage(message));
        setDetail(null);
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      }
    })();

    return () => {
      controller.abort();
    };
  }, [accessToken, sessionId]);

  const resolveStopId = (task: FieldTask): number | undefined => {
    if (typeof task.stop_id === 'number' && task.stop_id > 0) {
      return task.stop_id;
    }
    const matched = detail?.stops.find((stop) => stop.task_id === task.task_id);
    if (matched && typeof matched.stop_id === 'number') {
      return matched.stop_id;
    }
    return undefined;
  };

  const handleTaskPress = (task: FieldTask) => {
    navigation.navigate(ScreenNames.GEO_HISTORY_TASK_DETAIL, {
      taskId: task.task_id,
      stopId: resolveStopId(task),
      sessionId,
    });
  };

  const handleTaskRoutePress = (task: FieldTask) => {
    navigation.navigate(ScreenNames.GEO_HISTORY_MAP, {
      sessionId,
      taskId: task.task_id,
      taskName: task.name,
    });
  };

  const renderTaskCard = ({ item }: { item: FieldTask }) => {
    const address =
      typeof item.address === 'string' && item.address ? item.address : null;
    const checklistLabel =
      item.checklist_total_count > 0
        ? `${item.checklist_done_count}/${item.checklist_total_count} checklist`
        : null;

    return (
      <Pressable
        style={styles.taskCard}
        onPress={() => handleTaskPress(item)}
        accessibilityRole="button"
        accessibilityLabel={`Task ${item.name}`}
      >
        <View style={styles.taskCardBody}>
          <Text style={styles.taskName}>{item.name}</Text>
          {address ? (
            <Text style={styles.taskAddress} numberOfLines={2}>
              {address}
            </Text>
          ) : null}
          <Text style={styles.taskMeta}>
            {item.state}
            {checklistLabel ? ` · ${checklistLabel}` : ''}
          </Text>
        </View>
        <Pressable
          style={styles.routeChip}
          onPress={(e) => {
            e.stopPropagation?.();
            handleTaskRoutePress(item);
          }}
          accessibilityRole="button"
          accessibilityLabel={`View route for ${item.name}`}
        >
          <MaterialIcons
            name="map"
            size={isTablet ? 18 : 16}
            color={colors.button}
          />
          <Text style={styles.routeChipText}>Route</Text>
        </Pressable>
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
        {loading && !detail ? (
          <SessionDetailSkeleton />
        ) : error && !detail ? (
          <Text style={styles.emptyListText}>{error}</Text>
        ) : detail ? (
          <>
            <View style={styles.summaryCard}>
              <Text style={styles.summaryState}>{detail.state}</Text>
              <View style={styles.summaryMetaRow}>
                <Text style={styles.summaryMetaItem}>
                  {formatStat(detail.tracking_duration_hours, 'hrs')}
                </Text>
                <Text style={styles.summaryMetaItem}>
                  {formatStat(detail.total_distance_km, 'km')}
                </Text>
                <Text style={styles.summaryMetaItem}>
                  {detail.stop_count}{' '}
                  {detail.stop_count === 1 ? 'stop' : 'stops'}
                </Text>
                <Text style={styles.summaryMetaItem}>
                  {detail.task_count}{' '}
                  {detail.task_count === 1 ? 'task' : 'tasks'}
                </Text>
              </View>
            </View>

            <FlatList
              style={styles.taskList}
              contentContainerStyle={styles.taskListContent}
              data={detail.tasks}
              keyExtractor={(item) => String(item.task_id)}
              renderItem={renderTaskCard}
              showsVerticalScrollIndicator={false}
              ListEmptyComponent={
                <Text style={styles.emptyListText}>
                  No tasks in this session
                </Text>
              }
            />
          </>
        ) : null}
      </View>
    </SafeAreaView>
  );
};

export default GeoHistorySessionScreen;
