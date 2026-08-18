import React, { useCallback, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Platform,
  Pressable,
  StatusBar,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useFocusEffect } from '@react-navigation/native';
import DateTimePicker, {
  type DateTimePickerEvent,
} from '@react-native-community/datetimepicker';
import LinearGradient from 'react-native-linear-gradient';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import {
  fetchFieldTaskDetail,
  fetchFieldTasks,
  isRequestCanceled,
  type FieldTask,
  type FieldTaskCounts,
} from '../../services/apiClient';
import { useAppSelector } from '../../store/hooks';
import { useAppTheme } from '../../theme/ThemeContext';
import { useBottomContentPadding } from '../../hooks/useBottomContentPadding';
import { useResponsive } from '../../hooks/useResponsive';
import { getCurrentCoordinates } from '../../utils/locationGate';
import {
  formatPauseReasonLine,
  isTaskStartBlocked,
  resolveTaskBadge,
  type TaskBadgeVariant,
} from '../../utils/fieldTaskUi';
import { showAlert } from '../../components/common/customAlert/alertService';
import { TaskRoutingSkeleton } from '../../components/common/skeleton/ScreenSkeletons';
import { createStyles } from './TaskRoutingScreenStyle';
import { getAuthErrorMessage } from '../../constants/ApiEndpoints';
import { ScreenNames } from '../../constants/ScreenNames';
import { RootStackParamList } from '../../navigation/AppNavigator';

type Props = NativeStackScreenProps<
  RootStackParamList,
  typeof ScreenNames.TASK_ROUTING
>;

type CardStatus = 'pending' | 'active' | 'paused' | 'completed';

type FilterChip = 'all' | CardStatus;

const PAGE_SIZE = 10;

const MONTHS_LONG = [
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

const FILTER_CHIPS: { key: FilterChip; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'pending', label: 'Pending' },
  { key: 'active', label: 'Active' },
  { key: 'paused', label: 'Paused' },
  { key: 'completed', label: 'Completed' },
];

const EMPTY_COUNTS: FieldTaskCounts = {
  all: 0,
  pending: 0,
  active: 0,
  paused: 0,
  completed: 0,
  cancelled: 0,
  overdue: 0,
};

function pad2(n: number) {
  return String(n).padStart(2, '0');
}

function toLocalDateKey(date: Date) {
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;
}

function todayLocalDateKey() {
  return toLocalDateKey(new Date());
}

function parseLocalDateKey(key: string) {
  const [year, month, day] = key.split('-').map(Number);
  return new Date(year, month - 1, day);
}

function formatDisplayDate(key: string) {
  const date = parseLocalDateKey(key);
  return `${date.getDate()} ${MONTHS_LONG[date.getMonth()]} ${date.getFullYear()}`;
}

/** API datetimes are naive UTC `YYYY-MM-DD HH:MM:SS`. */
function parseOdooUtc(value: string | false | null | undefined): Date | null {
  if (typeof value !== 'string' || !value.trim()) {
    return null;
  }
  const parsed = new Date(`${value.trim().replace(' ', 'T')}Z`);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function formatCardDay(date: Date) {
  return `${date.getDate()} ${MONTHS_LONG[date.getMonth()].slice(0, 3)}`;
}

function formatTaskWindow(
  startTaskDate: string | false | null | undefined,
  deadline: string | false | null | undefined,
): string | null {
  const start = parseOdooUtc(startTaskDate);
  const end = parseOdooUtc(deadline);
  if (!start && !end) {
    return null;
  }
  if (start && end) {
    const startLabel = formatCardDay(start);
    const endLabel = formatCardDay(end);
    if (toLocalDateKey(start) === toLocalDateKey(end)) {
      return startLabel;
    }
    return `${startLabel} – ${endLabel}`;
  }
  return formatCardDay((start ?? end) as Date);
}

function toCardStatus(status: string): CardStatus {
  if (status === 'active') {
    return 'active';
  }
  if (status === 'paused') {
    return 'paused';
  }
  if (status === 'completed') {
    return 'completed';
  }
  return 'pending';
}

function formatDistance(distanceKm: number | false | null | undefined): string | null {
  if (typeof distanceKm !== 'number' || !Number.isFinite(distanceKm)) {
    return null;
  }
  return `${distanceKm.toFixed(1)} km away`;
}

function taskTitle(task: FieldTask): string {
  if (typeof task.partner_name === 'string' && task.partner_name.trim()) {
    return task.partner_name;
  }
  return task.name || 'Task';
}

function taskAddress(task: FieldTask): string {
  if (typeof task.address === 'string' && task.address.trim()) {
    return task.address;
  }
  return '—';
}

const TaskRoutingScreen = ({ navigation }: Props) => {
  const { colors, isDark } = useAppTheme();
  const { isTablet, contentMaxWidth } = useResponsive();
  const styles = createStyles(colors, isTablet, contentMaxWidth);
  const bottomPadding = useBottomContentPadding(isTablet ? 24 : 16);
  const accessToken = useAppSelector((state) => state.auth.accessToken);

  const [activeChip, setActiveChip] = useState<FilterChip>('all');
  const [selectedDate, setSelectedDate] = useState(todayLocalDateKey);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [tasks, setTasks] = useState<FieldTask[]>([]);
  const [counts, setCounts] = useState<FieldTaskCounts>(EMPTY_COUNTS);
  const [checkedIn, setCheckedIn] = useState(true);
  const [activeTaskId, setActiveTaskId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [listLoading, setListLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const hasLoadedOnceRef = useRef(false);
  const lastCoordsRef = useRef<{ latitude: number; longitude: number } | null>(
    null,
  );

  const navigateToTaskMap = useCallback(
    (item: FieldTask) => {
      if (!checkedIn) {
        showAlert({
          title: 'Check in first',
          message: 'Check in before starting or navigating to a task.',
        });
        return;
      }
      if (
        typeof item.latitude !== 'number' ||
        typeof item.longitude !== 'number' ||
        !Number.isFinite(item.latitude) ||
        !Number.isFinite(item.longitude)
      ) {
        showAlert({
          title: 'Location missing',
          message: 'This task does not have a valid store location.',
        });
        return;
      }
      navigation.navigate(ScreenNames.TASK_MAP, {
        taskId: item.task_id,
        title: taskTitle(item),
        address: taskAddress(item),
        latitude: item.latitude,
        longitude: item.longitude,
        distanceKm:
          typeof item.distance_km === 'number' &&
          Number.isFinite(item.distance_km)
            ? item.distance_km
            : null,
        status: item.status,
        isUpcoming: Boolean(item.is_upcoming),
      });
    },
    [checkedIn, navigation],
  );

  const loadTasks = useCallback(
    async (
      isCancelled: () => boolean,
      options?: { refreshGps?: boolean },
    ) => {
      if (!accessToken) {
        setError('Session expired. Please log in again.');
        setTasks([]);
        hasLoadedOnceRef.current = true;
        setLoading(false);
        setListLoading(false);
        return;
      }

      const isFirstLoad = !hasLoadedOnceRef.current;
      if (isFirstLoad) {
        setLoading(true);
      } else {
        setListLoading(true);
      }
      setError(null);

      let latitude: number | undefined;
      let longitude: number | undefined;
      const cached = lastCoordsRef.current;
      const shouldFetchGps = isFirstLoad || Boolean(options?.refreshGps);

      if (shouldFetchGps) {
        try {
          const coords = await Promise.race([
            getCurrentCoordinates(),
            new Promise<null>((resolve) => {
              setTimeout(() => resolve(null), 4000);
            }),
          ]);
          if (!isCancelled() && coords) {
            latitude = coords.latitude;
            longitude = coords.longitude;
            lastCoordsRef.current = {
              latitude: coords.latitude,
              longitude: coords.longitude,
            };
          }
        } catch {
          // Soft GPS: list still loads without distance.
        }
        if (latitude == null && cached) {
          latitude = cached.latitude;
          longitude = cached.longitude;
        }
      } else if (cached) {
        latitude = cached.latitude;
        longitude = cached.longitude;
      }

      if (isCancelled()) {
        return;
      }

      try {
        const result = await fetchFieldTasks(accessToken, {
          status: activeChip,
          from: selectedDate,
          to: selectedDate,
          date_field: 'calendar',
          limit: PAGE_SIZE,
          offset: (page - 1) * PAGE_SIZE,
          latitude,
          longitude,
        });
        if (isCancelled()) {
          return;
        }
        console.log(
          '[TaskRouting] order',
          result.tasks.map((t) => ({
            task_id: t.task_id,
            status: t.status,
            name: t.name,
            partner_name: t.partner_name,
          })),
        );
        setTasks(result.tasks);
        const nextTotal =
          typeof result.total === 'number' && Number.isFinite(result.total)
            ? result.total
            : result.tasks.length;
        setTotal(nextTotal);
        if (nextTotal > 0 && (page - 1) * PAGE_SIZE >= nextTotal) {
          setPage(1);
        }
        setCounts({ ...EMPTY_COUNTS, ...(result.counts ?? {}) });
        setCheckedIn(Boolean(result.checked_in));
        setActiveTaskId(
          typeof result.active_task_id === 'number'
            ? result.active_task_id
            : null,
        );
        setError(null);
      } catch (e) {
        if (isCancelled() || isRequestCanceled(e)) {
          return;
        }
        const message =
          e instanceof Error ? e.message : 'tasks_failed';
        setError(getAuthErrorMessage(message));
        setTasks([]);
        setTotal(0);
      } finally {
        if (!isCancelled()) {
          hasLoadedOnceRef.current = true;
          setLoading(false);
          setListLoading(false);
        }
      }
    },
    [accessToken, activeChip, page, selectedDate],
  );

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      void loadTasks(() => cancelled);
      return () => {
        cancelled = true;
      };
    }, [loadTasks]),
  );

  const isBusy = loading || listLoading;

  const handleRefresh = useCallback(() => {
    if (isBusy) {
      return;
    }
    void loadTasks(() => false, { refreshGps: true });
  }, [isBusy, loadTasks]);

  const totalPages = useMemo(
    () => Math.max(1, Math.ceil(total / PAGE_SIZE)),
    [total],
  );
  const canGoPrev = page > 1 && !isBusy;
  const canGoNext = page < totalPages && total > 0 && !isBusy;

  const selectChip = useCallback((chip: FilterChip) => {
    setActiveChip(chip);
    setPage(1);
  }, []);

  const handleDateChange = useCallback(
    (event: DateTimePickerEvent, date?: Date) => {
      if (Platform.OS === 'android') {
        setShowDatePicker(false);
      }
      if (event.type === 'dismissed' || !date) {
        return;
      }
      const nextKey = toLocalDateKey(date);
      setSelectedDate((prev) => {
        if (prev === nextKey) {
          return prev;
        }
        setPage(1);
        return nextKey;
      });
      if (Platform.OS === 'ios') {
        setShowDatePicker(false);
      }
    },
    [],
  );

  const goToPrevPage = useCallback(() => {
    if (!canGoPrev) {
      return;
    }
    setPage((prev) => Math.max(1, prev - 1));
  }, [canGoPrev]);

  const goToNextPage = useCallback(() => {
    if (!canGoNext) {
      return;
    }
    setPage((prev) => prev + 1);
  }, [canGoNext]);

  const iconSize = isTablet ? 26 : 22;

  const renderTaskCard = ({ item }: { item: FieldTask }) => {
    const cardStatus = toCardStatus(item.status);
    const badge = resolveTaskBadge(item);
    const showStatusAlongside =
      (cardStatus === 'active' || cardStatus === 'paused') &&
      (badge.variant === 'overdue' || badge.variant === 'upcoming');
    const badgeStyleFor = (variant: TaskBadgeVariant) => {
      if (variant === 'overdue') {
        return styles.statusBadgeOverdue;
      }
      if (variant === 'upcoming') {
        return styles.statusBadgeUpcoming;
      }
      if (variant === 'active') {
        return styles.statusBadgeActive;
      }
      if (variant === 'paused') {
        return styles.statusBadgePaused;
      }
      if (variant === 'completed') {
        return styles.statusBadgeCompleted;
      }
      return styles.statusBadgePending;
    };
    const badgeTextStyleFor = (variant: TaskBadgeVariant) => {
      if (variant === 'overdue') {
        return styles.statusBadgeTextOverdue;
      }
      if (variant === 'upcoming') {
        return styles.statusBadgeTextUpcoming;
      }
      if (variant === 'active') {
        return styles.statusBadgeTextActive;
      }
      if (variant === 'paused') {
        return styles.statusBadgeTextPaused;
      }
      if (variant === 'completed') {
        return styles.statusBadgeTextCompleted;
      }
      return styles.statusBadgeTextPending;
    };

    const showActions =
      item.status === 'pending' ||
      item.status === 'active' ||
      item.status === 'paused';
    const isPaused = item.status === 'paused';
    const startBlocked = isTaskStartBlocked(item);
    const ctaDisabled = startBlocked && item.status !== 'active';
    const ctaLabel = isPaused
      ? 'Resume'
      : item.status === 'active'
        ? 'Navigate'
        : 'Get Start';
    const distance = formatDistance(item.distance_km);
    const windowLabel = formatTaskWindow(item.start_task_date, item.deadline);
    const startDate = parseOdooUtc(item.start_task_date);
    const startsLabel =
      item.is_upcoming && startDate
        ? `Starts ${formatCardDay(startDate)}`
        : null;
    const pauseLine = isPaused ? formatPauseReasonLine(item) : null;

    const onCtaPress = () => {
      if (ctaDisabled) {
        return;
      }
      navigateToTaskMap(item);
    };

    return (
      <View style={styles.card}>
        <View style={styles.cardTop}>
          <Text style={styles.cardTitle} numberOfLines={1}>
            {taskTitle(item)}
          </Text>
          <View style={styles.badgeRow}>
            {showStatusAlongside ? (
              <View
                style={[
                  styles.statusBadge,
                  cardStatus === 'active'
                    ? styles.statusBadgeActive
                    : styles.statusBadgePaused,
                ]}
              >
                <Text
                  style={[
                    styles.statusBadgeText,
                    cardStatus === 'active'
                      ? styles.statusBadgeTextActive
                      : styles.statusBadgeTextPaused,
                  ]}
                >
                  {cardStatus === 'active' ? 'Active' : 'Paused'}
                </Text>
              </View>
            ) : null}
            <View style={[styles.statusBadge, badgeStyleFor(badge.variant)]}>
              <Text
                style={[
                  styles.statusBadgeText,
                  badgeTextStyleFor(badge.variant),
                ]}
              >
                {badge.label}
              </Text>
            </View>
          </View>
        </View>

        <View style={styles.addressRow}>
          <MaterialIcons
            name="place"
            size={isTablet ? 18 : 16}
            color={colors.textEnabled}
          />
          <Text style={styles.addressText}>{taskAddress(item)}</Text>
        </View>

        {windowLabel ? (
          <View style={styles.dateRow}>
            <MaterialIcons
              name="event"
              size={isTablet ? 18 : 16}
              color={colors.textEnabled}
            />
            <Text style={styles.dateRangeText}>{windowLabel}</Text>
          </View>
        ) : null}

        {startsLabel ? (
          <View style={styles.dateRow}>
            <MaterialIcons
              name="schedule"
              size={isTablet ? 18 : 16}
              color={colors.textEnabled}
            />
            <Text style={styles.dateRangeText}>{startsLabel}</Text>
          </View>
        ) : null}

        {pauseLine ? (
          <View style={styles.dateRow}>
            <MaterialIcons
              name="pause-circle-outline"
              size={isTablet ? 18 : 16}
              color={colors.textEnabled}
            />
            <Text style={styles.dateRangeText}>{pauseLine}</Text>
          </View>
        ) : null}

        {showActions ? (
          <>
            <View style={styles.actionRow}>
              <Pressable
                style={[
                  styles.ctaButton,
                  ctaDisabled && styles.ctaButtonDisabled,
                ]}
                onPress={onCtaPress}
                disabled={ctaDisabled}
                accessibilityRole="button"
                accessibilityLabel={ctaLabel}
                accessibilityState={{ disabled: ctaDisabled }}
              >
                <LinearGradient
                  colors={[...colors.buttonGradient]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 0, y: 1 }}
                  style={styles.ctaGradient}
                >
                  <MaterialIcons
                    name={isPaused ? 'play-arrow' : 'near-me'}
                    size={isTablet ? 18 : 16}
                    color={colors.buttonText}
                  />
                  <Text style={styles.ctaText}>{ctaLabel}</Text>
                </LinearGradient>
              </Pressable>
              {distance ? (
                <Text style={styles.distanceText}>{distance}</Text>
              ) : null}
            </View>

            <View style={styles.cardDivider} />

            <Pressable
              style={styles.footerRow}
              onPress={() =>
                navigation.navigate(ScreenNames.WHAT_NEEDS_TO_BE_DONE, {
                  taskId: item.task_id,
                })
              }
              accessibilityRole="button"
              accessibilityLabel="What Needs to Be Done"
            >
              <Text style={styles.footerText}>What Needs to Be Done</Text>
              <MaterialIcons
                name="chevron-right"
                size={isTablet ? 24 : 22}
                color={colors.textEnabled}
              />
            </Pressable>
          </>
        ) : null}
      </View>
    );
  };

  const countForChip = (key: FilterChip): number => {
    if (key === 'all') {
      return counts.all;
    }
    return counts[key] ?? 0;
  };

  const resumeTask = tasks.find((t) => t.task_id === activeTaskId);

  const handleResumeActive = useCallback(() => {
    if (resumeTask) {
      navigateToTaskMap(resumeTask);
      return;
    }
    if (!accessToken || activeTaskId == null) {
      return;
    }
    void (async () => {
      try {
        const detail = await fetchFieldTaskDetail(accessToken, activeTaskId);
        navigateToTaskMap(detail);
      } catch (e) {
        const message =
          e instanceof Error ? e.message : 'task_detail_failed';
        showAlert({
          title: 'Could not open task',
          message: getAuthErrorMessage(message),
        });
      }
    })();
  }, [accessToken, activeTaskId, navigateToTaskMap, resumeTask]);

  const listHeader = (
    <View>
      {!checkedIn ? (
        <View style={styles.checkInBanner}>
          <Text style={styles.checkInBannerText}>
            Check in first to start or navigate tasks.
          </Text>
        </View>
      ) : null}

      {activeTaskId != null ? (
        <Pressable
          style={styles.resumeBanner}
          onPress={handleResumeActive}
          accessibilityRole="button"
          accessibilityLabel="Resume active task"
        >
          <Text style={styles.resumeBannerText}>
            {resumeTask
              ? `Resume active task: ${taskTitle(resumeTask)}`
              : 'Resume active task'}
          </Text>
          <MaterialIcons
            name="chevron-right"
            size={isTablet ? 24 : 22}
            color={colors.button}
          />
        </Pressable>
      ) : null}

      <Pressable
        style={styles.dateFilterRow}
        onPress={() => setShowDatePicker(true)}
        accessibilityRole="button"
        accessibilityLabel={`Select date, currently ${formatDisplayDate(selectedDate)}`}
      >
        <View style={styles.dateFilterTextWrap}>
          <Text style={styles.dateFilterLabel}>Tasks for</Text>
          <Text style={styles.dateFilterValue}>
            {formatDisplayDate(selectedDate)}
          </Text>
        </View>
        <MaterialIcons
          name="calendar-today"
          size={isTablet ? 22 : 20}
          color={colors.button}
        />
      </Pressable>

      <View style={styles.filtersHeader}>
        <Text style={styles.filtersLabel}>QUICK FILTERS</Text>
        <Pressable
          onPress={() => selectChip('all')}
          accessibilityRole="button"
          accessibilityLabel="Clear All"
        >
          <Text style={styles.clearAll}>Clear All</Text>
        </Pressable>
      </View>

      <View style={styles.chipRow}>
        {FILTER_CHIPS.map((chip) => {
          const selected = activeChip === chip.key;
          const count = countForChip(chip.key);
          const label = `${chip.label} (${count})`;
          const inner = (
            <View
              style={[styles.chipInner, selected && styles.chipInnerSelected]}
            >
              <Text
                style={[styles.chipText, selected && styles.chipTextSelected]}
              >
                {label}
              </Text>
            </View>
          );

          return (
            <Pressable
              key={chip.key}
              style={styles.chip}
              onPress={() => selectChip(chip.key)}
              accessibilityRole="button"
              accessibilityState={{ selected }}
              accessibilityLabel={label}
            >
              {selected ? (
                <LinearGradient
                  colors={[...colors.buttonGradient]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 0, y: 1 }}
                  style={[styles.chipInner, styles.chipInnerSelected]}
                >
                  <Text style={[styles.chipText, styles.chipTextSelected]}>
                    {label}
                  </Text>
                </LinearGradient>
              ) : (
                inner
              )}
            </Pressable>
          );
        })}
      </View>

      {error ? <Text style={styles.errorText}>{error}</Text> : null}
    </View>
  );

  const showInitialSpinner = loading && !hasLoadedOnceRef.current;

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
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
            size={iconSize}
            color={colors.textEnabled}
          />
        </Pressable>
        <Text style={styles.headerTitle}>Task Routing List</Text>
        <View style={styles.headerActions}>
          <Pressable
            style={styles.headerButton}
            onPress={handleRefresh}
            accessibilityRole="button"
            accessibilityLabel="Refresh"
            disabled={isBusy}
          >
            {isBusy ? (
              <ActivityIndicator size="small" color={colors.textEnabled} />
            ) : (
              <MaterialIcons
                name="sync"
                size={iconSize}
                color={colors.textEnabled}
              />
            )}
          </Pressable>
        </View>
      </View>

      {showInitialSpinner ? (
        <TaskRoutingSkeleton />
      ) : (
        <FlatList
          data={listLoading ? [] : tasks}
          keyExtractor={(item) => String(item.task_id)}
          renderItem={renderTaskCard}
          ListHeaderComponent={listHeader}
          ListFooterComponent={
            !listLoading && (totalPages > 1 || page > 1) ? (
              <View style={styles.paginationRow}>
                <Pressable
                  style={[
                    styles.paginationButton,
                    !canGoPrev && styles.paginationButtonDisabled,
                  ]}
                  onPress={goToPrevPage}
                  disabled={!canGoPrev}
                  accessibilityRole="button"
                  accessibilityLabel="Previous page"
                  accessibilityState={{ disabled: !canGoPrev }}
                >
                  <Text
                    style={[
                      styles.paginationButtonText,
                      !canGoPrev && styles.paginationButtonTextDisabled,
                    ]}
                  >
                    Previous
                  </Text>
                </Pressable>
                <Text style={styles.paginationInfo}>
                  Page {page} of {totalPages}
                </Text>
                <Pressable
                  style={[
                    styles.paginationButton,
                    !canGoNext && styles.paginationButtonDisabled,
                  ]}
                  onPress={goToNextPage}
                  disabled={!canGoNext}
                  accessibilityRole="button"
                  accessibilityLabel="Next page"
                  accessibilityState={{ disabled: !canGoNext }}
                >
                  <Text
                    style={[
                      styles.paginationButtonText,
                      !canGoNext && styles.paginationButtonTextDisabled,
                    ]}
                  >
                    Next
                  </Text>
                </Pressable>
              </View>
            ) : null
          }
          contentContainerStyle={[
            styles.listContent,
            { paddingBottom: bottomPadding },
          ]}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            listLoading ? (
              <View style={styles.loadingWrap}>
                <ActivityIndicator color={colors.button} />
              </View>
            ) : (
              <View style={styles.emptyState}>
                <Text style={styles.emptyText}>
                  {error
                    ? 'Unable to load tasks.'
                    : activeChip !== 'all'
                      ? `No ${activeChip} tasks for ${formatDisplayDate(selectedDate)}.`
                      : `No tasks for ${formatDisplayDate(selectedDate)}.`}
                </Text>
              </View>
            )
          }
        />
      )}

      {showDatePicker ? (
        <DateTimePicker
          value={parseLocalDateKey(selectedDate)}
          mode="date"
          display={Platform.OS === 'ios' ? 'spinner' : 'default'}
          onChange={handleDateChange}
        />
      ) : null}
    </SafeAreaView>
  );
};

export default TaskRoutingScreen;
