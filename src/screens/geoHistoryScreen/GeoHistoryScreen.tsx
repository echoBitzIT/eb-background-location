import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Modal,
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
import { BrandGradient } from '../../constants/Colors';
import { getAuthErrorMessage } from '../../constants/ApiEndpoints';
import { ScreenNames } from '../../constants/ScreenNames';
import { RootStackParamList } from '../../navigation/AppNavigator';
import {
  fetchFieldHistory,
  fetchFieldHistoryYears,
  isRequestCanceled,
  type FieldHistoryDay,
} from '../../services/apiClient';
import { useAppSelector } from '../../store/hooks';
import { useAppTheme } from '../../theme/ThemeContext';
import { useResponsive } from '../../hooks/useResponsive';
import { DayListSkeleton } from '../../components/common/skeleton/ScreenSkeletons';
import { createStyles } from './GeoHistoryScreenStyle';

type Props = NativeStackScreenProps<
  RootStackParamList,
  typeof ScreenNames.GEO_HISTORY
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

function pad2(n: number) {
  return String(n).padStart(2, '0');
}

function toDateKey(year: number, month: number, day: number) {
  return `${year}-${pad2(month + 1)}-${pad2(day)}`;
}

function daysInMonth(year: number, month: number) {
  return new Date(year, month + 1, 0).getDate();
}

function parseDateKey(key: string) {
  const [year, month, day] = key.split('-').map(Number);
  return new Date(year, month - 1, day);
}

function formatStat(value: number, unit: string) {
  const rounded = Number.isInteger(value) ? String(value) : value.toFixed(1);
  return `${rounded} ${unit}`;
}

const GeoHistoryScreen = ({ navigation }: Props) => {
  const { colors, isDark } = useAppTheme();
  const { isTablet, contentMaxWidth } = useResponsive();
  const styles = createStyles(colors, isTablet, contentMaxWidth, isDark);
  const accessToken = useAppSelector((state) => state.auth.accessToken);

  const today = useMemo(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), now.getDate());
  }, []);

  const [viewYear, setViewYear] = useState(today.getFullYear());
  const [viewMonth, setViewMonth] = useState(today.getMonth());
  const [yearPickerOpen, setYearPickerOpen] = useState(false);
  const [yearOptions, setYearOptions] = useState<number[]>([]);
  const [days, setDays] = useState<FieldHistoryDay[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const monthScrollRef = useRef<ScrollView>(null);

  const listDays = useMemo(() => {
    return [...days].sort((a, b) =>
      a.date < b.date ? 1 : a.date > b.date ? -1 : 0,
    );
  }, [days]);

  useEffect(() => {
    const pillWidth = isTablet ? 64 : 56;
    const pillGap = isTablet ? 10 : 8;
    const x = Math.max(0, viewMonth * (pillWidth + pillGap));

    const frame = requestAnimationFrame(() => {
      monthScrollRef.current?.scrollTo({ x, animated: true });
    });

    return () => cancelAnimationFrame(frame);
  }, [viewMonth, isTablet]);

  useEffect(() => {
    if (!accessToken) {
      setYearOptions([]);
      return;
    }

    const controller = new AbortController();

    (async () => {
      try {
        const years = await fetchFieldHistoryYears(accessToken, {
          signal: controller.signal,
        });
        if (controller.signal.aborted) {
          return;
        }
        setYearOptions(years);
        if (years.length > 0) {
          setViewYear((current) =>
            years.includes(current) ? current : years[0],
          );
        }
      } catch (e) {
        if (controller.signal.aborted || isRequestCanceled(e)) {
          return;
        }
        setYearOptions([]);
      }
    })();

    return () => {
      controller.abort();
    };
  }, [accessToken, reloadKey]);

  useEffect(() => {
    if (!accessToken) {
      setError('Session expired. Please log in again.');
      setDays([]);
      return;
    }

    const from = toDateKey(viewYear, viewMonth, 1);
    const to = toDateKey(viewYear, viewMonth, daysInMonth(viewYear, viewMonth));

    const controller = new AbortController();
    setLoading(true);
    setError(null);

    (async () => {
      try {
        const result = await fetchFieldHistory(accessToken, from, to, {
          signal: controller.signal,
        });
        if (controller.signal.aborted) {
          return;
        }
        setDays(result.days);
      } catch (e) {
        if (controller.signal.aborted || isRequestCanceled(e)) {
          return;
        }
        const message = e instanceof Error ? e.message : 'history_failed';
        setError(getAuthErrorMessage(message));
        setDays([]);
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

  const iconSize = isTablet ? 26 : 22;

  const handleMonthPress = (monthIndex: number) => {
    setViewMonth(monthIndex);
  };

  const handleYearSelect = (year: number) => {
    setViewYear(year);
    setYearPickerOpen(false);
  };

  const handleRefresh = () => {
    setReloadKey((key) => key + 1);
  };

  const handleDayPress = (date: string) => {
    navigation.navigate(ScreenNames.GEO_HISTORY_DAY, { date });
  };

  const renderDayCard = ({ item }: { item: FieldHistoryDay }) => {
    const date = parseDateKey(item.date);
    const monthLabel = MONTHS_SHORT[date.getMonth()];
    const dayNumber = date.getDate();

    return (
      <Pressable
        style={styles.dayCard}
        onPress={() => handleDayPress(item.date)}
        accessibilityRole="button"
        accessibilityLabel={`History for ${item.date}`}
      >
        <View style={styles.dateStrip}>
          <Text style={styles.dateStripMonth}>{monthLabel}</Text>
          <Text style={styles.dateStripDay}>{dayNumber}</Text>
        </View>

        <View style={styles.dayCardBody}>
          <Text style={styles.dayCardTitle}>
            {item.session_count}{' '}
            {item.session_count === 1 ? 'session' : 'sessions'}
          </Text>
          <View style={styles.dayMetaRow}>
            <Text style={styles.dayMetaItem}>
              {formatStat(item.tracking_hours, 'hrs')}
            </Text>
            <Text style={styles.dayMetaItem}>
              {formatStat(item.total_distance_km, 'km')}
            </Text>
            <Text style={styles.dayMetaItem}>
              {item.stop_count} {item.stop_count === 1 ? 'stop' : 'stops'}
            </Text>
            <Text style={styles.dayMetaItem}>
              {item.tasks_completed}{' '}
              {item.tasks_completed === 1 ? 'task' : 'tasks'}
            </Text>
          </View>
        </View>

        <View style={styles.dayCardChevron}>
          <MaterialIcons
            name="chevron-right"
            size={isTablet ? 28 : 24}
            color={colors.textDisabled}
          />
        </View>
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

        <Text style={styles.headerTitle}>Geo History</Text>

        <View style={styles.headerActions}>
          <Pressable
            style={styles.yearChip}
            onPress={() => setYearPickerOpen(true)}
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
            onPress={handleRefresh}
            accessibilityRole="button"
            accessibilityLabel="Refresh history"
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

      <View style={styles.content}>
        {error ? (
          <Text style={styles.emptyListText}>{error}</Text>
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
                  onPress={() => handleMonthPress(index)}
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
                onPress={() => handleMonthPress(index)}
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
              error ? null : (
                <Text style={styles.emptyListText}>
                  No tracking history for {MONTHS_SHORT[viewMonth]} {viewYear}
                </Text>
              )
            }
          />
        )}
      </View>

      <Modal
        visible={yearPickerOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setYearPickerOpen(false)}
      >
        <Pressable
          style={styles.modalBackdrop}
          onPress={() => setYearPickerOpen(false)}
          accessibilityRole="button"
          accessibilityLabel="Close year picker"
        >
          <Pressable
            style={styles.yearPickerCard}
            onPress={(e) => e.stopPropagation()}
          >
            <Text style={styles.yearPickerTitle}>Select year</Text>
            {yearOptions.map((year) => {
              const selected = year === viewYear;
              return (
                <Pressable
                  key={year}
                  style={[
                    styles.yearOption,
                    selected && styles.yearOptionSelected,
                  ]}
                  onPress={() => handleYearSelect(year)}
                  accessibilityRole="button"
                  accessibilityState={{ selected }}
                  accessibilityLabel={`Year ${year}`}
                >
                  <Text style={styles.yearOptionText}>{year}</Text>
                  {selected ? (
                    <MaterialIcons
                      name="check"
                      size={isTablet ? 22 : 20}
                      color={colors.button}
                    />
                  ) : null}
                </Pressable>
              );
            })}
          </Pressable>
        </Pressable>
      </Modal>
    </SafeAreaView>
  );
};

export default GeoHistoryScreen;
