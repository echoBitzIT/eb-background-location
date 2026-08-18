import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  ScrollView,
  StatusBar,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import LinearGradient from 'react-native-linear-gradient';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import {
  ATTENDANCE_LEGEND_ORDER,
  ATTENDANCE_STATUS_COLORS,
  ATTENDANCE_STATUS_LABELS,
  type AttendanceDayStatus,
} from '../../constants/AttendanceStatus';
import { BrandGradient } from '../../constants/Colors';
import { getAuthErrorMessage } from '../../constants/ApiEndpoints';
import { ScreenNames } from '../../constants/ScreenNames';
import { RootStackParamList } from '../../navigation/AppNavigator';
import {
  fetchAttendanceCalendar,
  isRequestCanceled,
  type AttendanceCalendarDay,
  type AttendanceCalendarPunch,
} from '../../services/apiClient';
import { useAppSelector } from '../../store/hooks';
import { useAppTheme } from '../../theme/ThemeContext';
import { useResponsive } from '../../hooks/useResponsive';
import { DayListSkeleton } from '../../components/common/skeleton/ScreenSkeletons';
import { createStyles } from './AttendanceCalendarScreenStyle';

type Props = NativeStackScreenProps<
  RootStackParamList,
  typeof ScreenNames.ATTENDANCE_CALENDAR
>;

type ViewMode = 'calendar' | 'list';

const WEEKDAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const;

const WEEKDAYS = [
  'Sunday',
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
] as const;

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

const STATUS_LETTER: Record<AttendanceDayStatus, string> = {
  present: 'P',
  absent: 'A',
  leave: 'L',
  half_day: 'H',
  holiday: 'Y',
  weekly_off: 'O',
  scheduled: 'S',
};

const OFF_STATUSES: AttendanceDayStatus[] = [
  'weekly_off',
  'holiday',
  'leave',
  'absent',
  'scheduled',
];

function pad2(value: number) {
  return value.toString().padStart(2, '0');
}

function toDateKey(year: number, month: number, day: number) {
  return `${year}-${pad2(month + 1)}-${pad2(day)}`;
}

function parseDateKey(key: string): Date {
  const [year, month, day] = key.split('-').map(Number);
  return new Date(year, month - 1, day);
}

function formatViewMonth(year: number, month: number) {
  return `${MONTHS_SHORT[month]}, ${String(year).slice(-2)}`;
}

function startOfMonth(year: number, month: number) {
  return new Date(year, month, 1);
}

function daysInMonth(year: number, month: number) {
  return new Date(year, month + 1, 0).getDate();
}

/** Format API ISO / Odoo datetime string to display time like `10:00 AM`. */
function formatDisplayTime(value: string | false | null | undefined): string | null {
  if (!value || typeof value !== 'string') {
    return null;
  }

  const parsed = new Date(value.includes('T') ? value : value.replace(' ', 'T'));
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }

  let hours = parsed.getHours();
  const minutes = parsed.getMinutes();
  const suffix = hours >= 12 ? 'PM' : 'AM';
  hours = hours % 12;
  if (hours === 0) {
    hours = 12;
  }
  return `${pad2(hours)}:${pad2(minutes)} ${suffix}`;
}

function resolvePunchTimes(punch: {
  check_in: string | false;
  check_out: string | false;
  check_in_local: string | false;
  check_out_local: string | false;
}): {
  checkIn: string | null;
  checkOut: string | null;
} {
  const checkIn = formatDisplayTime(punch.check_in_local || punch.check_in);
  const checkOut = formatDisplayTime(punch.check_out_local || punch.check_out);
  return { checkIn, checkOut };
}

function resolveDayPunches(day: AttendanceCalendarDay): Array<{
  key: string;
  checkIn: string | null;
  checkOut: string | null;
  isOpen: boolean;
}> {
  if (Array.isArray(day.attendances) && day.attendances.length > 0) {
    return day.attendances.map((punch: AttendanceCalendarPunch, index) => {
      const { checkIn, checkOut } = resolvePunchTimes(punch);
      return {
        key: String(punch.attendance_id ?? index),
        checkIn,
        checkOut,
        isOpen: punch.is_open,
      };
    });
  }

  const { checkIn, checkOut } = resolvePunchTimes(day);
  if (!checkIn && !checkOut) {
    return [];
  }

  return [
    {
      key: `${day.date}-fallback`,
      checkIn,
      checkOut,
      isOpen: day.is_open,
    },
  ];
}

type CalendarCell = {
  key: string;
  day: number;
  inCurrentMonth: boolean;
  status?: AttendanceDayStatus;
};

function buildMonthGrid(
  year: number,
  month: number,
  statusByDate: Record<string, AttendanceDayStatus>,
): CalendarCell[] {
  const firstWeekday = startOfMonth(year, month).getDay();
  const currentCount = daysInMonth(year, month);
  const prevMonth = month === 0 ? 11 : month - 1;
  const prevYear = month === 0 ? year - 1 : year;
  const prevCount = daysInMonth(prevYear, prevMonth);

  const cells: CalendarCell[] = [];

  for (let i = firstWeekday - 1; i >= 0; i -= 1) {
    const day = prevCount - i;
    cells.push({
      key: toDateKey(prevYear, prevMonth, day),
      day,
      inCurrentMonth: false,
      status: undefined,
    });
  }

  for (let day = 1; day <= currentCount; day += 1) {
    const key = toDateKey(year, month, day);
    cells.push({
      key,
      day,
      inCurrentMonth: true,
      status: statusByDate[key],
    });
  }

  const trailing = (7 - (cells.length % 7)) % 7;
  const nextMonth = month === 11 ? 0 : month + 1;
  const nextYear = month === 11 ? year + 1 : year;
  for (let day = 1; day <= trailing; day += 1) {
    cells.push({
      key: toDateKey(nextYear, nextMonth, day),
      day,
      inCurrentMonth: false,
      status: undefined,
    });
  }

  return cells;
}

const AttendanceCalendarScreen = ({ navigation }: Props) => {
  const { colors, isDark } = useAppTheme();
  const { isTablet, contentMaxWidth } = useResponsive();
  const styles = createStyles(colors, isTablet, contentMaxWidth, isDark);
  const accessToken = useAppSelector((state) => state.auth.accessToken);

  const today = useMemo(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), now.getDate());
  }, []);

  const [viewMode, setViewMode] = useState<ViewMode>('calendar');
  const [viewYear, setViewYear] = useState(today.getFullYear());
  const [viewMonth, setViewMonth] = useState(today.getMonth());
  const [selectedKey, setSelectedKey] = useState(
    toDateKey(today.getFullYear(), today.getMonth(), today.getDate()),
  );
  const [statusByDate, setStatusByDate] = useState<
    Record<string, AttendanceDayStatus>
  >({});
  const [calendarDays, setCalendarDays] = useState<AttendanceCalendarDay[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const monthScrollRef = useRef<ScrollView>(null);

  const selectedDate = useMemo(() => parseDateKey(selectedKey), [selectedKey]);
  const cells = useMemo(
    () => buildMonthGrid(viewYear, viewMonth, statusByDate),
    [viewYear, viewMonth, statusByDate],
  );

  const listDays = useMemo(() => {
    return [...calendarDays].sort((a, b) =>
      a.date < b.date ? 1 : a.date > b.date ? -1 : 0,
    );
  }, [calendarDays]);

  useEffect(() => {
    if (viewMode !== 'list') {
      return;
    }

    const pillWidth = isTablet ? 64 : 56;
    const pillGap = isTablet ? 10 : 8;
    const x = Math.max(0, viewMonth * (pillWidth + pillGap));

    const frame = requestAnimationFrame(() => {
      monthScrollRef.current?.scrollTo({ x, animated: true });
    });

    return () => cancelAnimationFrame(frame);
  }, [viewMode, viewMonth, isTablet]);

  useEffect(() => {
    if (!accessToken) {
      setError('Session expired. Please log in again.');
      setCalendarDays([]);
      return;
    }

    const from = toDateKey(viewYear, viewMonth, 1);
    const to = toDateKey(viewYear, viewMonth, daysInMonth(viewYear, viewMonth));

    const controller = new AbortController();
    setLoading(true);
    setError(null);

    (async () => {
      try {
        const result = await fetchAttendanceCalendar(accessToken, from, to, {
          signal: controller.signal,
        });
        if (controller.signal.aborted) {
          return;
        }

        const map: Record<string, AttendanceDayStatus> = {};
        for (const day of result.days) {
          map[day.date] = day.status;
        }

        setStatusByDate(map);
        setCalendarDays(result.days);
      } catch (e) {
        if (controller.signal.aborted || isRequestCanceled(e)) {
          return;
        }
        const message =
          e instanceof Error ? e.message : 'attendance_calendar_failed';
        setError(getAuthErrorMessage(message));
        setCalendarDays([]);
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      }
    })();

    return () => {
      controller.abort();
    };
  }, [accessToken, viewYear, viewMonth, reloadKey]);

  const navigateToMonth = (year: number, month: number) => {
    setViewYear(year);
    setViewMonth(month);
    const day =
      today.getFullYear() === year && today.getMonth() === month
        ? today.getDate()
        : 1;
    setSelectedKey(toDateKey(year, month, day));
  };

  const goToPrevMonth = () => {
    if (viewMonth === 0) {
      navigateToMonth(viewYear - 1, 11);
    } else {
      navigateToMonth(viewYear, viewMonth - 1);
    }
  };

  const goToNextMonth = () => {
    if (viewMonth === 11) {
      navigateToMonth(viewYear + 1, 0);
    } else {
      navigateToMonth(viewYear, viewMonth + 1);
    }
  };

  const handleListMonthPress = (monthIndex: number) => {
    navigateToMonth(viewYear, monthIndex);
  };

  const handleSync = () => {
    setReloadKey((key) => key + 1);
  };

  const switchToList = () => {
    setViewMode('list');
  };

  const switchToCalendar = () => {
    setViewMode('calendar');
  };

  const iconSize = isTablet ? 26 : 22;
  const isListMode = viewMode === 'list';

  const renderDayCard = ({ item }: { item: AttendanceCalendarDay }) => {
    const date = parseDateKey(item.date);
    const monthLabel = MONTHS_SHORT[date.getMonth()];
    const dayNumber = date.getDate();
    const punches = resolveDayPunches(item);
    const isOffDay = OFF_STATUSES.includes(item.status) || punches.length === 0;
    const statusColor = ATTENDANCE_STATUS_COLORS[item.status];
    const subtitle =
      typeof item.label === 'string' && item.label
        ? item.label
        : ATTENDANCE_STATUS_LABELS[item.status];

    return (
      <View style={styles.dayCard}>
        <View style={styles.dateStrip}>
          <Text style={styles.dateStripMonth}>{monthLabel}</Text>
          <Text style={styles.dateStripDay}>{dayNumber}</Text>
        </View>

        <View style={styles.dayCardBody}>
          {isOffDay ? (
            <View style={styles.offDayWrap}>
              <Text style={styles.offDayTitle}>
                {WEEKDAYS[date.getDay()]}
              </Text>
              <Text style={styles.offDaySubtitle}>{subtitle}</Text>
            </View>
          ) : (
            <View style={styles.punchList}>
              {punches.map((punch, index) => (
                <React.Fragment key={punch.key}>
                  {index > 0 ? <View style={styles.punchDivider} /> : null}
                  <View style={styles.punchRow}>
                    <View style={styles.timeColumn}>
                      <Text style={styles.timeLabel}>Check-in</Text>
                      <Text style={styles.timeValue}>{punch.checkIn ?? '—'}</Text>
                    </View>
                    <View style={styles.timeDivider} />
                    <View style={styles.timeColumn}>
                      <Text style={styles.timeLabel}>Check-out</Text>
                      <Text style={styles.timeValue}>
                        {punch.isOpen ? '—' : punch.checkOut ?? '—'}
                      </Text>
                    </View>
                  </View>
                </React.Fragment>
              ))}
            </View>
          )}
        </View>

        <View style={[styles.statusBar, { backgroundColor: statusColor }]}>
          <Text style={styles.statusBarLetter}>{STATUS_LETTER[item.status]}</Text>
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right', 'bottom']}>
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

        <Text style={styles.headerTitle}>
          {isListMode ? 'Attendance' : 'Attendance Calendar'}
        </Text>

        <View style={styles.headerActions}>
          {isListMode ? (
            <>
              <Pressable
                style={styles.yearChip}
                onPress={() => {}}
                accessibilityRole="button"
                accessibilityLabel={`Year ${viewYear}`}
              >
                <Text style={styles.yearChipText}>{viewYear}</Text>
                <MaterialIcons
                  name="keyboard-arrow-down"
                  size={isTablet ? 22 : 18}
                  color={colors.textEnabled}
                />
              </Pressable>
              <Pressable
                style={styles.headerButton}
                onPress={switchToCalendar}
                accessibilityRole="button"
                accessibilityLabel="Calendar view"
              >
                <MaterialIcons
                  name="calendar-month"
                  size={iconSize}
                  color={colors.textEnabled}
                />
              </Pressable>
            </>
          ) : (
            <Pressable
              style={styles.headerButton}
              onPress={switchToList}
              accessibilityRole="button"
              accessibilityLabel="List view"
            >
              <MaterialIcons
                name="menu"
                size={iconSize}
                color={colors.textEnabled}
              />
            </Pressable>
          )}
          <Pressable
            style={styles.headerButton}
            onPress={handleSync}
            accessibilityRole="button"
            accessibilityLabel="Sync"
          >
            {loading ? (
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

      {isListMode ? (
        <View style={[styles.content, styles.listModeContent]}>
          {error ? (
            <Text style={[styles.selectedWeekdayText, { marginBottom: 8 }]}>
              {error}
            </Text>
          ) : null}

          <ScrollView
            ref={monthScrollRef}
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.monthPillsScroll}
            contentContainerStyle={styles.monthPillsContent}
          >
            {MONTHS_SHORT.map((label, index) => {
              const selected = index === viewMonth;
              if (selected) {
                return (
                  <Pressable
                    key={label}
                    style={[styles.monthPill, styles.monthPillActive]}
                    onPress={() => handleListMonthPress(index)}
                    accessibilityRole="button"
                    accessibilityLabel={label}
                    accessibilityState={{ selected: true }}
                  >
                    <LinearGradient
                      colors={[...BrandGradient]}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 0, y: 1 }}
                      style={styles.monthPillGradient}
                    >
                      <Text style={styles.monthPillTextActive}>{label}</Text>
                    </LinearGradient>
                  </Pressable>
                );
              }

              return (
                <Pressable
                  key={label}
                  style={styles.monthPill}
                  onPress={() => handleListMonthPress(index)}
                  accessibilityRole="button"
                  accessibilityLabel={label}
                  accessibilityState={{ selected: false }}
                >
                  <Text style={styles.monthPillText}>{label}</Text>
                </Pressable>
              );
            })}
          </ScrollView>

          {loading && listDays.length === 0 ? (
            <View style={styles.dayList}>
              <DayListSkeleton />
            </View>
          ) : (
            <FlatList
              style={styles.dayList}
              contentContainerStyle={styles.dayListContent}
              data={listDays}
              keyExtractor={(item) => item.date}
              renderItem={renderDayCard}
              showsVerticalScrollIndicator={false}
              ListEmptyComponent={
                <Text style={styles.emptyListText}>
                  No attendance records for {MONTHS_SHORT[viewMonth]} {viewYear}
                </Text>
              }
            />
          )}
        </View>
      ) : (
        <View style={styles.content}>
          {error ? (
            <Text style={[styles.selectedWeekdayText, { marginBottom: 8 }]}>
              {error}
            </Text>
          ) : null}

          <View style={styles.calendarCard}>
            <View style={styles.calendarHeader}>
              <View style={styles.dateBlock}>
                <Text style={styles.selectedDateText}>
                  {formatViewMonth(viewYear, viewMonth)}
                </Text>
                <Text style={styles.selectedWeekdayText}>
                  {WEEKDAYS[selectedDate.getDay()]}
                </Text>
              </View>
              <View style={styles.monthNav}>
                <Pressable
                  style={styles.monthNavButton}
                  onPress={goToPrevMonth}
                  accessibilityRole="button"
                  accessibilityLabel="Previous month"
                >
                  <MaterialIcons
                    name="chevron-left"
                    size={isTablet ? 28 : 24}
                    color={colors.textEnabled}
                  />
                </Pressable>
                <Pressable
                  style={styles.monthNavButton}
                  onPress={goToNextMonth}
                  accessibilityRole="button"
                  accessibilityLabel="Next month"
                >
                  <MaterialIcons
                    name="chevron-right"
                    size={isTablet ? 28 : 24}
                    color={colors.textEnabled}
                  />
                </Pressable>
              </View>
            </View>

            <View style={styles.weekdayRow}>
              {WEEKDAY_LABELS.map((label) => (
                <View key={label} style={styles.weekdayCell}>
                  <Text style={styles.weekdayText}>{label}</Text>
                </View>
              ))}
            </View>

            <View style={styles.daysGrid}>
              {cells.map((cell) => {
                const selected = cell.key === selectedKey;
                const statusColor =
                  cell.status && cell.status !== 'scheduled'
                    ? ATTENDANCE_STATUS_COLORS[cell.status]
                    : undefined;

                return (
                  <Pressable
                    key={cell.key}
                    style={styles.dayCell}
                    onPress={() => setSelectedKey(cell.key)}
                    accessibilityRole="button"
                    accessibilityLabel={`Day ${cell.day}`}
                  >
                    <View
                      style={[
                        styles.dayNumberWrap,
                        selected && styles.dayNumberWrapSelected,
                      ]}
                    >
                      <Text
                        style={[
                          styles.dayNumber,
                          !cell.inCurrentMonth && styles.dayNumberOutside,
                          selected && styles.dayNumberSelected,
                        ]}
                      >
                        {cell.day}
                      </Text>
                    </View>
                    {statusColor ? (
                      <View
                        style={[
                          styles.statusDot,
                          { backgroundColor: statusColor },
                        ]}
                      />
                    ) : (
                      <View style={styles.statusDotPlaceholder} />
                    )}
                  </Pressable>
                );
              })}
            </View>
          </View>

          <View style={styles.legendGrid}>
            {ATTENDANCE_LEGEND_ORDER.map((status) => (
              <View key={status} style={styles.legendItem}>
                <View
                  style={[
                    styles.legendDot,
                    { backgroundColor: ATTENDANCE_STATUS_COLORS[status] },
                  ]}
                />
                <Text style={styles.legendLabel} numberOfLines={1}>
                  {ATTENDANCE_STATUS_LABELS[status]}
                </Text>
              </View>
            ))}
          </View>
        </View>
      )}
    </SafeAreaView>
  );
};

export default AttendanceCalendarScreen;
