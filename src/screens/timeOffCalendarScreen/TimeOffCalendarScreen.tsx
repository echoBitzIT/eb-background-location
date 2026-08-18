import React, { useCallback, useMemo, useState } from 'react';
import {
  FlatList,
  Pressable,
  StatusBar, 
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import LinearGradient from 'react-native-linear-gradient';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import { ScreenNames } from '../../constants/ScreenNames';
import { getAuthErrorMessage } from '../../constants/ApiEndpoints';
import { RootStackParamList } from '../../navigation/AppNavigator';
import {
  fetchHrLeaves,
  fetchHrLeaveTypes,
  isRequestCanceled,
  type HrLeaveRecord,
  type HrLeaveType,
} from '../../services/apiClient';
import { useAppSelector } from '../../store/hooks';
import { useAppTheme } from '../../theme/ThemeContext';
import { useBottomContentPadding } from '../../hooks/useBottomContentPadding';
import { useResponsive } from '../../hooks/useResponsive';
import { TimeOffSkeleton } from '../../components/common/skeleton/ScreenSkeletons';
import { createStyles } from './TimeOffCalendarScreenStyle';

type Props = NativeStackScreenProps<
  RootStackParamList,
  typeof ScreenNames.TIME_OFF_CALENDAR
>;

type FilterChip = 'all' | 'pending' | 'approved';

type StatusBadgeKind = 'pending' | 'approved' | 'refused' | 'cancelled';

type LeaveRecord = HrLeaveRecord;

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

const FILTER_CHIPS: { key: FilterChip; label: string }[] = [
  { key: 'all', label: 'All Requests' },
  { key: 'pending', label: 'Pending' },
  { key: 'approved', label: 'Approved' },
];

function pad2(value: number) {
  return value.toString().padStart(2, '0');
}

/** Whole numbers use pad2; fractional days show up to 1 decimal. */
function formatRemainingDays(value: number) {
  if (Number.isInteger(value)) {
    return pad2(value);
  }
  return value.toFixed(1).replace(/\.0$/, '');
}

function resolvePaidTimeOffRemaining(types: HrLeaveType[]): number {
  const byName = types.find(
    (type) => type.name.toLowerCase() === 'paid time off',
  );
  if (byName) {
    return byName.virtual_remaining_leaves;
  }
  const fallback = types.find(
    (type) => !type.unpaid && type.has_valid_allocation,
  );
  return fallback?.virtual_remaining_leaves ?? 0;
}

function formatLeaveDate(iso: string) {
  const [year, month, day] = iso.split('-').map(Number);
  if (!year || !month || !day) {
    return iso;
  }
  return `${MONTHS_SHORT[month - 1]} ${pad2(day)}`;
}

function formatDateRange(from: string, to: string) {
  if (from === to) {
    return formatLeaveDate(from);
  }
  return `${formatLeaveDate(from)} - ${formatLeaveDate(to)}`;
}

function formatDuration(days: number) {
  const value = Number.isInteger(days)
    ? String(days)
    : days.toFixed(1).replace(/\.0$/, '');
  const unit = days === 1 ? 'day' : 'days';
  return `${value} ${unit} duration`;
}

function mapLeaveState(state: string): StatusBadgeKind {
  switch (state) {
    case 'validate':
      return 'approved';
    case 'refuse':
      return 'refused';
    case 'cancel':
      return 'cancelled';
    case 'confirm':
    case 'draft':
    default:
      return 'pending';
  }
}

function statusLabel(kind: StatusBadgeKind) {
  switch (kind) {
    case 'approved':
      return 'Approved';
    case 'refused':
      return 'Refused';
    case 'cancelled':
      return 'Cancelled';
    default:
      return 'Pending';
  }
}

function leaveTypeIcon(name: string): string {
  const lower = name.toLowerCase();
  if (lower.includes('sick') || lower.includes('medical')) {
    return 'medical-services';
  }
  if (lower.includes('remote') || lower.includes('work from')) {
    return 'home';
  }
  if (lower.includes('unpaid')) {
    return 'money-off';
  }
  return 'luggage';
}

function matchesChip(leave: LeaveRecord, chip: FilterChip) {
  const kind = mapLeaveState(leave.state);
  if (chip === 'all') {
    return true;
  }
  if (chip === 'pending') {
    return kind === 'pending';
  }
  return kind === 'approved';
}

const TimeOffCalendarScreen = ({ navigation }: Props) => {
  const { colors, isDark } = useAppTheme();
  const { isTablet, contentMaxWidth } = useResponsive();
  const fabSize = isTablet ? 64 : 56;
  const fabBottom = useBottomContentPadding(isTablet ? 32 : 24);
  const listBottomPadding = useBottomContentPadding(
    (isTablet ? 32 : 24) + fabSize + 24,
  );
  const styles = createStyles(colors, isTablet, contentMaxWidth, isDark);
  const iconSize = isTablet ? 26 : 22;

  const accessToken = useAppSelector((state) => state.auth.accessToken);
  const employeeId = useAppSelector((state) => state.auth.employee?.id);

  const [leaves, setLeaves] = useState<LeaveRecord[]>([]);
  const [remainingPaidDays, setRemainingPaidDays] = useState<number | null>(
    null,
  );
  const [activeChip, setActiveChip] = useState<FilterChip>('all');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useFocusEffect(
    useCallback(() => {
      if (!accessToken || !employeeId) {
        console.log('[TimeOff] list load skip', {
          hasToken: Boolean(accessToken),
          employeeId: employeeId ?? null,
        });
        setError('Session expired. Please log in again.');
        setLeaves([]);
        setRemainingPaidDays(null);
        setLoading(false);
        return;
      }

      const controller = new AbortController();
      setLoading(true);
      setError(null);
      setRemainingPaidDays(null);
      console.log('[TimeOff] list load start', {
        employeeId,
        reloadKey,
      });

      (async () => {
        const leavesPromise = fetchHrLeaves(accessToken, employeeId, {}, {
          signal: controller.signal,
        });
        const typesPromise = fetchHrLeaveTypes(accessToken, {
          signal: controller.signal,
        }).then(
          (types) => {
            if (controller.signal.aborted) {
              return;
            }
            const remaining = resolvePaidTimeOffRemaining(types);
            console.log('[TimeOff] paid balance load success', {
              remaining,
              typeCount: types.length,
            });
            setRemainingPaidDays(remaining);
          },
          (e) => {
            if (controller.signal.aborted || isRequestCanceled(e)) {
              return;
            }
            const message =
              e instanceof Error ? e.message : 'Failed to load leave types';
            console.log('[TimeOff] paid balance load error', { message });
            setRemainingPaidDays(0);
          },
        );

        try {
          const rows = await leavesPromise;
          if (controller.signal.aborted) {
            return;
          }
          console.log('[TimeOff] list load success', { count: rows.length });
          setLeaves(rows);
        } catch (e) {
          if (controller.signal.aborted || isRequestCanceled(e)) {
            return;
          }
          const message =
            e instanceof Error ? e.message : 'Failed to load time off';
          console.log('[TimeOff] list load error', { message });
          setError(getAuthErrorMessage(message));
          setLeaves([]);
        } finally {
          await typesPromise;
          if (!controller.signal.aborted) {
            setLoading(false);
          }
        }
      })();

      return () => controller.abort();
    }, [accessToken, employeeId, reloadKey]),
  );

  const handleRefresh = () => {
    console.log('[TimeOff] list refresh');
    setActiveChip('all');
    setReloadKey((key) => key + 1);
  };

  const filteredLeaves = useMemo(() => {
    return leaves.filter((leave) => matchesChip(leave, activeChip));
  }, [leaves, activeChip]);

  const renderLeaveCard = ({ item }: { item: LeaveRecord }) => {
    const typeName = item.holiday_status_id?.display_name ?? 'Time Off';
    const kind = mapLeaveState(item.state);
    const badgeStyle =
      kind === 'approved'
        ? styles.statusBadgeApproved
        : kind === 'refused'
          ? styles.statusBadgeRefused
          : kind === 'cancelled'
            ? styles.statusBadgeCancelled
            : styles.statusBadgePending;
    const badgeTextStyle =
      kind === 'approved'
        ? styles.statusBadgeTextApproved
        : kind === 'refused'
          ? styles.statusBadgeTextRefused
          : kind === 'cancelled'
            ? styles.statusBadgeTextCancelled
            : styles.statusBadgeTextPending;

    return (
      <View style={styles.leaveCard}>
        <View style={styles.leaveCardTop}>
          <View style={styles.leaveIconWrap}>
            <MaterialIcons
              name={leaveTypeIcon(typeName)}
              size={isTablet ? 22 : 20}
              color={colors.button}
            />
          </View>
          <View style={styles.leaveMain}>
            <Text style={styles.leaveTitle} numberOfLines={1}>
              {typeName}
            </Text>
            <Text style={styles.leaveDates} numberOfLines={1}>
              {formatDateRange(item.request_date_from, item.request_date_to)}
            </Text>
          </View>
          <View style={[styles.statusBadge, badgeStyle]}>
            <Text style={[styles.statusBadgeText, badgeTextStyle]}>
              {statusLabel(kind)}
            </Text>
          </View>
        </View>

        <View style={styles.leaveDivider} />

        <View style={styles.leaveCardBottom}>
          <View style={styles.leaveDurationRow}>
            <MaterialIcons
              name="schedule"
              size={isTablet ? 16 : 14}
              color={colors.textDisabled}
            />
            <Text style={styles.leaveDuration}>
              {formatDuration(item.number_of_days)}
            </Text>
          </View>
          <Pressable
            style={styles.kebabButton}
            accessibilityRole="button"
            accessibilityLabel="More options"
            onPress={() => {}}
          >
            <MaterialIcons
              name="more-vert"
              size={isTablet ? 22 : 20}
              color={colors.textDisabled}
            />
          </Pressable>
        </View>
      </View>
    );
  };

  const listHeader = (
    <View style={styles.listHeader}>
      <View style={styles.chipRow}>
        {FILTER_CHIPS.map((chip) => {
          const selected = activeChip === chip.key;
          const inner = (
            <View
              style={[
                styles.chipInner,
                selected && styles.chipInnerSelected,
              ]}
            >
              <Text
                style={[
                  styles.chipText,
                  selected && styles.chipTextSelected,
                ]}
              >
                {chip.label}
              </Text>
            </View>
          );

          return (
            <Pressable
              key={chip.key}
              style={styles.chip}
              onPress={() => setActiveChip(chip.key)}
              accessibilityRole="button"
              accessibilityState={{ selected }}
              accessibilityLabel={chip.label}
            >
              {selected ? (
                <LinearGradient
                  colors={[...colors.buttonGradient]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 0, y: 1 }}
                  style={[styles.chipInner, styles.chipInnerSelected]}
                >
                  <Text style={[styles.chipText, styles.chipTextSelected]}>
                    {chip.label}
                  </Text>
                </LinearGradient>
              ) : (
                inner
              )}
            </Pressable>
          );
        })}
      </View>

      <View style={styles.pendingCard}>
        <View style={styles.pendingLeft}>
          <MaterialIcons
            name="event-available"
            size={isTablet ? 18 : 16}
            color={colors.textDisabled}
          />
          <Text style={styles.pendingLabel}>PAID TIME OFF</Text>
        </View>
        <View style={styles.pendingRight}>
          <Text style={styles.pendingCount}>
            {remainingPaidDays === null
              ? '--'
              : formatRemainingDays(remainingPaidDays)}
          </Text>
          <Text style={styles.pendingHint}>Days available</Text>
        </View>
      </View>

      <Text style={styles.sectionTitle}>Recent Requests</Text>
    </View>
  );

  const listEmpty = loading && leaves.length === 0 ? (
    <TimeOffSkeleton />
  ) : error ? (
    <Text style={styles.errorText}>{error}</Text>
  ) : (
    <Text style={styles.emptyText}>
      {activeChip !== 'all'
        ? 'No matching requests.'
        : 'No time off requests yet.'}
    </Text>
  );

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
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

        <Text style={styles.headerTitle}>My Time Off</Text>

        <View style={styles.headerActions}>
          <Pressable
            style={styles.headerButton}
            onPress={handleRefresh}
            accessibilityRole="button"
            accessibilityLabel="Refresh"
          >
            <MaterialIcons
              name="sync"
              size={iconSize}
              color={colors.textEnabled}
            />
          </Pressable>
        </View>
      </View>

      <View style={styles.content}>
        <FlatList
          data={error ? [] : filteredLeaves}
          keyExtractor={(item) => String(item.id)}
          renderItem={renderLeaveCard}
          ListHeaderComponent={listHeader}
          contentContainerStyle={[
            styles.listContent,
            { paddingBottom: listBottomPadding },
          ]}
          ListEmptyComponent={listEmpty}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        />
      </View>

      <Pressable
        style={[
          styles.fab,
          { bottom: fabBottom },
        ]}
        onPress={() => {
          navigation.navigate(ScreenNames.TIME_OFF_REQUEST);
        }}
        accessibilityRole="button"
        accessibilityLabel="Add time off request"
      >
        <LinearGradient
          colors={[...colors.buttonGradient]}
          start={{ x: 0, y: 0 }}
          end={{ x: 0, y: 1 }}
          style={styles.fabGradient}
        >
          <MaterialIcons
            name="add"
            size={isTablet ? 32 : 28}
            color={colors.buttonText}
          />
        </LinearGradient>
      </Pressable>
    </SafeAreaView>
  );
};

export default TimeOffCalendarScreen;
