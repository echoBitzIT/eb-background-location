import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import LinearGradient from 'react-native-linear-gradient';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import { launchImageLibrary } from 'react-native-image-picker';
import {
  errorCodes,
  isErrorWithCode,
  keepLocalCopy,
  pick,
  types,
} from '@react-native-documents/picker';
import { viewDocument } from '@react-native-documents/viewer';
import { ScreenNames } from '../../constants/ScreenNames';
import { getAuthErrorMessage } from '../../constants/ApiEndpoints';
import { RootStackParamList } from '../../navigation/AppNavigator';
import {
  createHrLeave,
  fetchAttendanceCalendar,
  fetchHrLeaves,
  fetchHrLeaveTypes,
  isRequestCanceled,
  uploadHrLeaveAttachment,
  type HrLeaveRecord,
  type HrLeaveType,
} from '../../services/apiClient';
import { useAppSelector } from '../../store/hooks';
import { useAppTheme } from '../../theme/ThemeContext';
import { useResponsive } from '../../hooks/useResponsive';
import { showToast } from '../../components/common/customToast/toastService';
import { suppressSlowWaitToast } from '../../services/slowWaitToast';
import BottomSheet from '../../components/common/bottomSheet/BottomSheet';
import { createStyles } from './TimeOffRequestScreenStyle';

const ACTIVE_LEAVE_STATES = new Set(['draft', 'confirm', 'validate']);
const OCCUPIED_LEAVES_LIMIT = 200;

type Props = NativeStackScreenProps<
  RootStackParamList,
  typeof ScreenNames.TIME_OFF_REQUEST
>;

type CalendarCell = {
  key: string;
  day: number;
  inCurrentMonth: boolean;
};

type DayPeriod = 'am' | 'pm';

type DateField = 'from' | 'to';

type AttachmentFile = {
  uri: string;
  name: string;
  type?: string;
};

type LeaveType = HrLeaveType;

function isImageAttachment(file: AttachmentFile) {
  return (file.type ?? '').startsWith('image/');
}

function isPdfAttachment(file: AttachmentFile) {
  const type = (file.type ?? '').toLowerCase();
  const name = file.name.toLowerCase();
  return type === 'application/pdf' || name.endsWith('.pdf');
}

const WEEKDAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const;

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

function daysInMonth(year: number, month: number) {
  return new Date(year, month + 1, 0).getDate();
}

function formatDisplayDate(key: string) {
  const date = parseDateKey(key);
  return `${pad2(date.getDate())} ${MONTHS_SHORT[date.getMonth()]} ${date.getFullYear()}`;
}

function normalizeDateKey(value: string): string | null {
  if (!value || typeof value !== 'string') {
    return null;
  }
  const datePart = value.slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(datePart)) {
    return null;
  }
  return datePart;
}

function expandDateRangeKeys(fromKey: string, toKey: string): string[] {
  const start = parseDateKey(fromKey);
  const end = parseDateKey(toKey);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || start > end) {
    return [];
  }
  const keys: string[] = [];
  const cursor = new Date(start.getFullYear(), start.getMonth(), start.getDate());
  const last = new Date(end.getFullYear(), end.getMonth(), end.getDate());
  while (cursor <= last) {
    keys.push(
      toDateKey(cursor.getFullYear(), cursor.getMonth(), cursor.getDate()),
    );
    cursor.setDate(cursor.getDate() + 1);
  }
  return keys;
}

function buildOccupiedLeaveKeys(leaves: HrLeaveRecord[]): Set<string> {
  const keys = new Set<string>();
  for (const leave of leaves) {
    if (!ACTIVE_LEAVE_STATES.has(leave.state)) {
      continue;
    }
    const fromKey = normalizeDateKey(leave.request_date_from);
    const toKey = normalizeDateKey(leave.request_date_to || leave.request_date_from);
    if (!fromKey || !toKey) {
      continue;
    }
    for (const key of expandDateRangeKeys(fromKey, toKey)) {
      keys.add(key);
    }
  }
  return keys;
}

function monthCacheKey(year: number, month: number) {
  return `${year}-${pad2(month + 1)}`;
}

function buildMonthGrid(year: number, month: number): CalendarCell[] {
  const firstWeekday = new Date(year, month, 1).getDay();
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
    });
  }

  for (let day = 1; day <= currentCount; day += 1) {
    cells.push({
      key: toDateKey(year, month, day),
      day,
      inCurrentMonth: true,
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
    });
  }

  return cells;
}

const TimeOffRequestScreen = ({ navigation }: Props) => {
  const { colors, isDark } = useAppTheme();
  const { isTablet, contentMaxWidth } = useResponsive();
  const insets = useSafeAreaInsets();
  const styles = createStyles(colors, isTablet, contentMaxWidth);
  const iconSize = isTablet ? 24 : 22;

  const employee = useAppSelector((state) => state.auth.employee);
  const accessToken = useAppSelector((state) => state.auth.accessToken);
  const employeeName = employee?.name?.trim() || '';

  const today = useMemo(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), now.getDate());
  }, []);

  const todayKey = useMemo(
    () => toDateKey(today.getFullYear(), today.getMonth(), today.getDate()),
    [today],
  );

  const [leaveTypes, setLeaveTypes] = useState<LeaveType[]>([]);
  const [typesLoading, setTypesLoading] = useState(false);
  const [typesError, setTypesError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const [requestDateFrom, setRequestDateFrom] = useState<string | null>(null);
  const [requestDateTo, setRequestDateTo] = useState<string | null>(null);
  const [leaveTypeId, setLeaveTypeId] = useState<number | null>(null);
  const [leaveTypeLabel, setLeaveTypeLabel] = useState<string | null>(null);
  const [fromPeriod, setFromPeriod] = useState<DayPeriod>('am');
  const [toPeriod, setToPeriod] = useState<DayPeriod>('am');
  const [description, setDescription] = useState('');
  const [attachment, setAttachment] = useState<AttachmentFile | null>(null);
  const [previewVisible, setPreviewVisible] = useState(false);

  const [dateError, setDateError] = useState(false);
  const [typeError, setTypeError] = useState(false);
  const [descriptionError, setDescriptionError] = useState(false);

  const [dateModalVisible, setDateModalVisible] = useState(false);
  const [dateField, setDateField] = useState<DateField>('from');
  const [typeModalVisible, setTypeModalVisible] = useState(false);
  const [periodModalVisible, setPeriodModalVisible] = useState(false);
  const [periodField, setPeriodField] = useState<'from' | 'to'>('from');
  const [attachModalVisible, setAttachModalVisible] = useState(false);

  const [pickerYear, setPickerYear] = useState(today.getFullYear());
  const [pickerMonth, setPickerMonth] = useState(today.getMonth());

  const [occupiedLeaveKeys, setOccupiedLeaveKeys] = useState<Set<string>>(
    () => new Set(),
  );
  const [holidayKeys, setHolidayKeys] = useState<Set<string>>(() => new Set());
  const holidayCacheRef = useRef<Map<string, Set<string>>>(new Map());

  useEffect(() => {
    if (!accessToken) {
      console.log('[TimeOff] form types load skip', { hasToken: false });
      setTypesError('Session expired. Please log in again.');
      setLeaveTypes([]);
      setTypesLoading(false);
      return;
    }

    const controller = new AbortController();
    setTypesLoading(true);
    setTypesError(null);
    console.log('[TimeOff] form types load start');

    (async () => {
      try {
        const rows = await fetchHrLeaveTypes(accessToken, {
          signal: controller.signal,
        });
        if (controller.signal.aborted) {
          return;
        }
        console.log('[TimeOff] form types load success', {
          count: rows.length,
        });
        setLeaveTypes(rows);
      } catch (e) {
        if (controller.signal.aborted || isRequestCanceled(e)) {
          return;
        }
        const message =
          e instanceof Error ? e.message : 'Could not load leave types.';
        console.log('[TimeOff] form types load error', { message });
        const displayMessage = getAuthErrorMessage(message);
        setTypesError(displayMessage);
        setLeaveTypes([]);
      } finally {
        if (!controller.signal.aborted) {
          setTypesLoading(false);
        }
      }
    })();

    return () => controller.abort();
  }, [accessToken]);

  useEffect(() => {
    const employeeId = employee?.id;
    if (!accessToken || !employeeId) {
      setOccupiedLeaveKeys(new Set());
      return;
    }

    const controller = new AbortController();
    console.log('[TimeOff] form occupied leaves load start', { employeeId });

    (async () => {
      try {
        const rows = await fetchHrLeaves(
          accessToken,
          employeeId,
          { limit: OCCUPIED_LEAVES_LIMIT },
          { signal: controller.signal },
        );
        if (controller.signal.aborted) {
          return;
        }
        const keys = buildOccupiedLeaveKeys(rows);
        console.log('[TimeOff] form occupied leaves load success', {
          leaveCount: rows.length,
          occupiedDays: keys.size,
        });
        setOccupiedLeaveKeys(keys);
      } catch (e) {
        if (controller.signal.aborted || isRequestCanceled(e)) {
          return;
        }
        const message =
          e instanceof Error ? e.message : 'Could not load existing leaves.';
        console.log('[TimeOff] form occupied leaves load error', { message });
        setOccupiedLeaveKeys(new Set());
      }
    })();

    return () => controller.abort();
  }, [accessToken, employee?.id]);

  useEffect(() => {
    if (!dateModalVisible || !accessToken) {
      return;
    }

    const cacheKey = monthCacheKey(pickerYear, pickerMonth);
    const cached = holidayCacheRef.current.get(cacheKey);
    if (cached) {
      setHolidayKeys(cached);
      return;
    }

    const controller = new AbortController();
    const dateFrom = toDateKey(pickerYear, pickerMonth, 1);
    const dateTo = toDateKey(
      pickerYear,
      pickerMonth,
      daysInMonth(pickerYear, pickerMonth),
    );
    setHolidayKeys(new Set());
    console.log('[TimeOff] form holidays load start', {
      cacheKey,
      dateFrom,
      dateTo,
    });

    (async () => {
      try {
        const result = await fetchAttendanceCalendar(
          accessToken,
          dateFrom,
          dateTo,
          { signal: controller.signal },
        );
        if (controller.signal.aborted) {
          return;
        }
        const keys = new Set<string>();
        for (const day of result.days) {
          if (day.status !== 'holiday') {
            continue;
          }
          const key = normalizeDateKey(day.date);
          if (key) {
            keys.add(key);
          }
        }
        holidayCacheRef.current.set(cacheKey, keys);
        console.log('[TimeOff] form holidays load success', {
          cacheKey,
          holidayDays: keys.size,
        });
        setHolidayKeys(keys);
      } catch (e) {
        if (controller.signal.aborted || isRequestCanceled(e)) {
          return;
        }
        const message =
          e instanceof Error ? e.message : 'Could not load company holidays.';
        console.log('[TimeOff] form holidays load error', { message });
        setHolidayKeys(new Set());
      }
    })();

    return () => controller.abort();
  }, [accessToken, dateModalVisible, pickerMonth, pickerYear]);

  const pickerCells = useMemo(
    () => buildMonthGrid(pickerYear, pickerMonth),
    [pickerYear, pickerMonth],
  );

  const canGoPrevMonth = useMemo(() => {
    const currentYear = today.getFullYear();
    const currentMonth = today.getMonth();
    return (
      pickerYear > currentYear ||
      (pickerYear === currentYear && pickerMonth > currentMonth)
    );
  }, [pickerMonth, pickerYear, today]);

  const isDateDisabled = useCallback(
    (key: string) =>
      key < todayKey ||
      holidayKeys.has(key) ||
      occupiedLeaveKeys.has(key),
    [holidayKeys, occupiedLeaveKeys, todayKey],
  );

  const selectedLeaveType = useMemo(
    () => leaveTypes.find((type) => type.id === leaveTypeId) ?? null,
    [leaveTypes, leaveTypeId],
  );

  const showDayPeriod = selectedLeaveType?.request_unit === 'half_day';

  const allocatableTypes = useMemo(
    () => leaveTypes.filter((type) => type.has_valid_allocation),
    [leaveTypes],
  );

  const openDateModal = (field: DateField) => {
    const existing = field === 'from' ? requestDateFrom : requestDateTo;
    if (existing) {
      const date = parseDateKey(existing);
      const year = date.getFullYear();
      const month = date.getMonth();
      const currentYear = today.getFullYear();
      const currentMonth = today.getMonth();
      if (
        year < currentYear ||
        (year === currentYear && month < currentMonth)
      ) {
        setPickerYear(currentYear);
        setPickerMonth(currentMonth);
      } else {
        setPickerYear(year);
        setPickerMonth(month);
      }
    } else {
      setPickerYear(today.getFullYear());
      setPickerMonth(today.getMonth());
    }
    setDateField(field);
    setDateModalVisible(true);
  };

  const handleSelectDate = (cell: CalendarCell) => {
    if (isDateDisabled(cell.key)) {
      console.log('[TimeOff] Request select date blocked', {
        field: dateField,
        key: cell.key,
      });
      return;
    }
    console.log('[TimeOff] Request select date', {
      field: dateField,
      key: cell.key,
    });
    if (dateField === 'from') {
      setRequestDateFrom(cell.key);
      if (
        !requestDateTo ||
        cell.key > requestDateTo ||
        isDateDisabled(requestDateTo)
      ) {
        setRequestDateTo(cell.key);
      }
    } else {
      setRequestDateTo(cell.key);
      if (
        !requestDateFrom ||
        cell.key < requestDateFrom ||
        isDateDisabled(requestDateFrom)
      ) {
        setRequestDateFrom(cell.key);
      }
    }
    setDateError(false);
    if (!cell.inCurrentMonth) {
      const date = parseDateKey(cell.key);
      setPickerYear(date.getFullYear());
      setPickerMonth(date.getMonth());
    }
    setDateModalVisible(false);
  };

  const handleSelectType = (option: LeaveType) => {
    console.log('[TimeOff] Request select type', {
      id: option.id,
      name: option.name,
      request_unit: option.request_unit,
    });
    setLeaveTypeId(option.id);
    setLeaveTypeLabel(option.name);
    setTypeError(false);
    if (option.request_unit !== 'half_day') {
      setFromPeriod('am');
      setToPeriod('am');
    }
    setTypeModalVisible(false);
  };

  const handleSelectPeriod = (period: DayPeriod) => {
    console.log('[TimeOff] Request select period', {
      field: periodField,
      period,
    });
    if (periodField === 'from') {
      setFromPeriod(period);
    } else {
      setToPeriod(period);
    }
    setPeriodModalVisible(false);
  };

  const pickPhotoAttachment = async () => {
    console.log('[TimeOff] Request attach photo start');
    const result = await launchImageLibrary({
      mediaType: 'photo',
      selectionLimit: 1,
      quality: 0.8,
    });
    if (result.didCancel || result.errorCode) {
      console.log('[TimeOff] Request attach photo cancelled', {
        didCancel: result.didCancel,
        errorCode: result.errorCode,
      });
      return;
    }
    const asset = result.assets?.[0];
    if (!asset?.uri) {
      console.log('[TimeOff] Request attach photo missing uri');
      return;
    }
    const name =
      asset.fileName || asset.uri.split('/').pop() || 'Attached file';
    const type = asset.type || 'image/jpeg';
    console.log('[TimeOff] Request attach photo success', { name, type });
    setAttachment({ uri: asset.uri, name, type });
  };

  const pickPdfAttachment = async () => {
    console.log('[TimeOff] Request attach PDF start');
    try {
      const [file] = await pick({
        type: [types.pdf],
        allowMultiSelection: false,
      });
      if (!file?.uri) {
        console.log('[TimeOff] Request attach PDF missing uri');
        return;
      }
      const name = file.name || file.uri.split('/').pop() || 'document.pdf';
      const type = file.type || 'application/pdf';
      const [localCopy] = await keepLocalCopy({
        files: [
          {
            uri: file.uri,
            fileName: name,
          },
        ],
        destination: 'cachesDirectory',
      });
      const uri =
        localCopy.status === 'success' ? localCopy.localUri : file.uri;
      console.log('[TimeOff] Request attach PDF success', {
        name,
        type,
        localCopyStatus: localCopy.status,
      });
      setAttachment({ uri, name, type });
    } catch (error) {
      if (isErrorWithCode(error) && error.code === errorCodes.OPERATION_CANCELED) {
        console.log('[TimeOff] Request attach PDF cancelled');
        return;
      }
      console.log('[TimeOff] Request attach PDF error', error);
      showToast({ message: 'Could not pick PDF', type: 'error' });
    }
  };

  const handleAttachFile = () => {
    console.log('[TimeOff] Request attach file start');
    setAttachModalVisible(true);
  };

  const handleRemoveAttachment = () => {
    setAttachment(null);
    setPreviewVisible(false);
  };

  const handlePreviewAttachment = async () => {
    if (!attachment) {
      return;
    }
    if (isImageAttachment(attachment)) {
      setPreviewVisible(true);
      return;
    }
    if (isPdfAttachment(attachment)) {
      try {
        await viewDocument({
          uri: attachment.uri,
          mimeType: attachment.type || 'application/pdf',
        });
      } catch (error) {
        console.log('[TimeOff] Request PDF preview error', error);
        showToast({ message: 'Unable to open PDF preview', type: 'error' });
      }
    }
  };

  const handleDiscard = () => {
    if (submitting) {
      return;
    }
    navigation.goBack();
  };

  const handleSubmit = async () => {
    if (submitting) {
      return;
    }

    if (!accessToken) {
      console.log('[TimeOff] form submit skip', { hasToken: false });
      showToast({
        message: 'Session expired. Please log in again.',
        type: 'error',
      });
      return;
    }

    const employeeId = employee?.id;
    if (!employeeId) {
      console.log('[TimeOff] form submit skip', { hasEmployeeId: false });
      showToast({
        message: 'Employee profile is missing. Please log in again.',
        type: 'error',
      });
      return;
    }

    if (typesLoading || typesError || allocatableTypes.length === 0) {
      showToast({
        message: typesError || 'Leave types are not available yet.',
        type: 'error',
      });
      return;
    }

    const nextDateError = !requestDateFrom || !requestDateTo;
    const nextTypeError = leaveTypeId == null || !leaveTypeLabel;
    const nextDescriptionError = !description.trim();

    setDateError(nextDateError);
    setTypeError(nextTypeError);
    setDescriptionError(nextDescriptionError);

    if (nextDateError || nextTypeError || nextDescriptionError) {
      showToast({
        message: 'Please fill all required fields.',
        type: 'error',
      });
      return;
    }

    if (
      requestDateFrom &&
      requestDateTo &&
      requestDateFrom > requestDateTo
    ) {
      setDateError(true);
      showToast({
        message: 'End date must be on or after start date.',
        type: 'error',
      });
      return;
    }

    const body = {
      holiday_status_id: leaveTypeId as number,
      employee_id: employeeId,
      request_date_from: requestDateFrom as string,
      request_date_to: requestDateTo as string,
      name: description.trim(),
      ...(showDayPeriod
        ? {
            request_date_from_period: fromPeriod,
            request_date_to_period: toPeriod,
          }
        : {}),
    };

    console.log('[TimeOff] form submit start', {
      holiday_status_id: body.holiday_status_id,
      employee_id: body.employee_id,
      request_date_from: body.request_date_from,
      request_date_to: body.request_date_to,
      hasAttachment: Boolean(attachment),
      halfDay: showDayPeriod,
    });

    setSubmitting(true);
    try {
      const leaveId = await createHrLeave(accessToken, body);

      if (attachment) {
        try {
          await uploadHrLeaveAttachment(accessToken, leaveId, attachment);
        } catch (attachError) {
          const attachMessage =
            attachError instanceof Error
              ? attachError.message
              : 'Could not upload the attachment.';
          console.log('[TimeOff] form submit attachment warning', {
            leaveId,
            message: attachMessage,
          });
          showToast({
            message:
              'Time off created, but attachment upload failed. You can retry later.',
            type: 'error',
          });
          suppressSlowWaitToast(4000);
          navigation.goBack();
          return;
        }
      }

      console.log('[TimeOff] form submit success', {
        leaveId,
        hasAttachment: Boolean(attachment),
      });
      showToast({
        message: 'Time off request submitted.',
        type: 'success',
      });
      suppressSlowWaitToast(4000);
      navigation.goBack();
    } catch (e) {
      const message =
        e instanceof Error
          ? e.message
          : 'Could not submit time off request.';
      console.log('[TimeOff] form submit error', { message });
      showToast({ message: getAuthErrorMessage(message), type: 'error' });
    } finally {
      setSubmitting(false);
    }
  };

  const goToPrevMonth = () => {
    if (!canGoPrevMonth) {
      return;
    }
    if (pickerMonth === 0) {
      setPickerYear((year) => year - 1);
      setPickerMonth(11);
      return;
    }
    setPickerMonth((month) => month - 1);
  };

  const goToNextMonth = () => {
    if (pickerMonth === 11) {
      setPickerYear((year) => year + 1);
      setPickerMonth(0);
      return;
    }
    setPickerMonth((month) => month + 1);
  };

  const selectedPickerKey =
    dateField === 'from' ? requestDateFrom : requestDateTo;

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
        <Text style={styles.headerTitle}>Time Off Request</Text>
      </View>

      <KeyboardAvoidingView
        style={styles.keyboardView}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 8 : 0}
      >
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={[styles.fieldRow, styles.fieldRowDisabled]}>
            <Text
              style={[
                styles.fieldText,
                !employeeName && styles.fieldPlaceholder,
              ]}
              numberOfLines={1}
            >
              {employeeName || 'Employee Name'}
            </Text>
          </View>

          <Pressable
            style={[styles.fieldRow, typeError && styles.fieldRowError]}
            onPress={() => setTypeModalVisible(true)}
            accessibilityRole="button"
            accessibilityLabel="Select Time Off Type"
          >
            <Text
              style={[
                styles.fieldText,
                !leaveTypeLabel && styles.fieldPlaceholder,
              ]}
            >
              {leaveTypeLabel || 'Select Time Off Type'}
            </Text>
            <MaterialIcons
              name="keyboard-arrow-down"
              size={isTablet ? 28 : 24}
              color={colors.textEnabled}
              style={styles.fieldIcon}
            />
          </Pressable>

          {showDayPeriod ? (
            <>
              <Pressable
                style={styles.fieldRow}
                onPress={() => {
                  setPeriodField('from');
                  setPeriodModalVisible(true);
                }}
                accessibilityRole="button"
                accessibilityLabel="Select start day period"
              >
                <Text style={styles.fieldText}>
                  Start Period: {fromPeriod.toUpperCase()}
                </Text>
                <MaterialIcons
                  name="keyboard-arrow-down"
                  size={isTablet ? 28 : 24}
                  color={colors.textEnabled}
                  style={styles.fieldIcon}
                />
              </Pressable>

              <Pressable
                style={styles.fieldRow}
                onPress={() => {
                  setPeriodField('to');
                  setPeriodModalVisible(true);
                }}
                accessibilityRole="button"
                accessibilityLabel="Select end day period"
              >
                <Text style={styles.fieldText}>
                  End Period: {toPeriod.toUpperCase()}
                </Text>
                <MaterialIcons
                  name="keyboard-arrow-down"
                  size={isTablet ? 28 : 24}
                  color={colors.textEnabled}
                  style={styles.fieldIcon}
                />
              </Pressable>
            </>
          ) : null}

          <Pressable
            style={[styles.fieldRow, dateError && styles.fieldRowError]}
            onPress={() => openDateModal('from')}
            accessibilityRole="button"
            accessibilityLabel="Select start date"
          >
            <Text
              style={[
                styles.fieldText,
                !requestDateFrom && styles.fieldPlaceholder,
              ]}
            >
              {requestDateFrom
                ? `From: ${formatDisplayDate(requestDateFrom)}`
                : 'Select Start Date'}
            </Text>
            <MaterialIcons
              name="calendar-today"
              size={iconSize}
              color={colors.textEnabled}
              style={styles.fieldIcon}
            />
          </Pressable>

          <Pressable
            style={[styles.fieldRow, dateError && styles.fieldRowError]}
            onPress={() => openDateModal('to')}
            accessibilityRole="button"
            accessibilityLabel="Select end date"
          >
            <Text
              style={[
                styles.fieldText,
                !requestDateTo && styles.fieldPlaceholder,
              ]}
            >
              {requestDateTo
                ? `To: ${formatDisplayDate(requestDateTo)}`
                : 'Select End Date'}
            </Text>
            <MaterialIcons
              name="calendar-today"
              size={iconSize}
              color={colors.textEnabled}
              style={styles.fieldIcon}
            />
          </Pressable>

          <View
            style={[
              styles.descriptionBox,
              descriptionError && styles.fieldRowError,
            ]}
          >
            <TextInput
              style={styles.descriptionInput}
              value={description}
              onChangeText={(text) => {
                setDescription(text);
                if (text.trim()) {
                  setDescriptionError(false);
                }
              }}
              placeholder="Enter descriptions provided"
              placeholderTextColor={colors.placeholder}
              multiline
              textAlignVertical="top"
            />
          </View>

          <View style={styles.attachmentRow}>
            <Text style={styles.attachmentLabel}>Attached Document</Text>
            <Pressable
              style={styles.attachButton}
              onPress={handleAttachFile}
              accessibilityRole="button"
              accessibilityLabel="Attached File"
            >
              <LinearGradient
                colors={[...colors.buttonGradient]}
                start={{ x: 0, y: 0 }}
                end={{ x: 0, y: 1 }}
                style={styles.attachButtonGradient}
              >
                <Text style={styles.attachButtonText}>Attached File</Text>
              </LinearGradient>
            </Pressable>
          </View>
          {selectedLeaveType?.support_document ? (
            <Text style={styles.attachmentName}>
              Supporting document recommended for this leave type.
            </Text>
          ) : null}
          {attachment ? (
            <View style={styles.previewBox}>
              <Pressable
                style={styles.previewContent}
                onPress={() => {
                  void handlePreviewAttachment();
                }}
                accessibilityRole="button"
                accessibilityLabel={
                  isPdfAttachment(attachment)
                    ? 'Preview PDF attachment'
                    : 'Preview image attachment'
                }
              >
                {isImageAttachment(attachment) ? (
                  <Image
                    source={{ uri: attachment.uri }}
                    style={styles.previewThumbnail}
                    resizeMode="cover"
                  />
                ) : (
                  <View style={styles.pdfPreviewRow}>
                    <MaterialIcons
                      name="picture-as-pdf"
                      size={isTablet ? 44 : 40}
                      color="#E53935"
                    />
                    <View style={styles.pdfPreviewTextWrap}>
                      <Text style={styles.previewFileName} numberOfLines={1}>
                        {attachment.name}
                      </Text>
                      <Text style={styles.previewHint}>Tap to preview</Text>
                    </View>
                  </View>
                )}
                {isImageAttachment(attachment) ? (
                  <Text style={styles.previewFileName} numberOfLines={1}>
                    {attachment.name}
                  </Text>
                ) : null}
              </Pressable>
              <Pressable
                style={styles.previewRemoveButton}
                onPress={handleRemoveAttachment}
                accessibilityRole="button"
                accessibilityLabel="Remove attachment"
                hitSlop={8}
              >
                <MaterialIcons
                  name="close"
                  size={isTablet ? 24 : 22}
                  color={colors.textEnabled}
                />
              </Pressable>
            </View>
          ) : null}
        </ScrollView>

        <View
          style={[
            styles.footer,
            { paddingBottom: isTablet ? 20 : 16 },
          ]}
        >
          <Pressable
            style={styles.discardButton}
            onPress={handleDiscard}
            disabled={submitting}
            accessibilityRole="button"
            accessibilityLabel="Discard"
          >
            <Text style={styles.discardText}>Discard</Text>
          </Pressable>

          <Pressable
            style={[
              styles.submitButton,
              (submitting || typesLoading) && { opacity: 0.7 },
            ]}
            onPress={() => {
              void handleSubmit();
            }}
            disabled={submitting || typesLoading}
            accessibilityRole="button"
            accessibilityLabel="Submit Request"
          >
            <LinearGradient
              colors={[...colors.buttonGradient]}
              start={{ x: 0, y: 0 }}
              end={{ x: 0, y: 1 }}
              style={styles.submitGradient}
            >
              {submitting ? (
                <ActivityIndicator color={colors.buttonText} />
              ) : (
                <Text style={styles.submitText}>Submit Request</Text>
              )}
            </LinearGradient>
          </Pressable>
        </View>
      </KeyboardAvoidingView>

      <Modal
        visible={typeModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setTypeModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <Pressable
            style={StyleSheet.absoluteFill}
            onPress={() => setTypeModalVisible(false)}
            accessibilityRole="button"
            accessibilityLabel="Dismiss time off type"
          />
          <View
            style={[
              styles.modalSheet,
              { paddingBottom: Math.max(insets.bottom, 20) },
            ]}
          >
            <Text style={styles.modalTitle}>Select Time Off Type</Text>
            {typesLoading ? (
              <ActivityIndicator color={colors.button} />
            ) : typesError ? (
              <Text style={styles.attachmentName}>{typesError}</Text>
            ) : allocatableTypes.length === 0 ? (
              <Text style={styles.attachmentName}>
                No leave types with a valid allocation.
              </Text>
            ) : (
              allocatableTypes.map((option) => {
                const selected = leaveTypeId === option.id;
                return (
                  <Pressable
                    key={option.id}
                    style={styles.optionRow}
                    onPress={() => handleSelectType(option)}
                    accessibilityRole="button"
                    accessibilityState={{ selected }}
                  >
                    <Text
                      style={[
                        styles.optionText,
                        selected && styles.optionTextSelected,
                      ]}
                    >
                      {option.name}
                    </Text>
                    {selected ? (
                      <MaterialIcons
                        name="check"
                        size={22}
                        color={colors.button}
                      />
                    ) : null}
                  </Pressable>
                );
              })
            )}
          </View>
        </View>
      </Modal>

      <Modal
        visible={periodModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setPeriodModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <Pressable
            style={StyleSheet.absoluteFill}
            onPress={() => setPeriodModalVisible(false)}
            accessibilityRole="button"
            accessibilityLabel="Dismiss day period"
          />
          <View
            style={[
              styles.modalSheet,
              { paddingBottom: Math.max(insets.bottom, 20) },
            ]}
          >
            <Text style={styles.modalTitle}>
              Select {periodField === 'from' ? 'Start' : 'End'} Period
            </Text>
            {(['am', 'pm'] as DayPeriod[]).map((period) => {
              const selected =
                (periodField === 'from' ? fromPeriod : toPeriod) === period;
              return (
                <Pressable
                  key={period}
                  style={styles.optionRow}
                  onPress={() => handleSelectPeriod(period)}
                  accessibilityRole="button"
                  accessibilityState={{ selected }}
                >
                  <Text
                    style={[
                      styles.optionText,
                      selected && styles.optionTextSelected,
                    ]}
                  >
                    {period.toUpperCase()}
                  </Text>
                  {selected ? (
                    <MaterialIcons
                      name="check"
                      size={22}
                      color={colors.button}
                    />
                  ) : null}
                </Pressable>
              );
            })}
          </View>
        </View>
      </Modal>

      <Modal
        visible={dateModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setDateModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <Pressable
            style={StyleSheet.absoluteFill}
            onPress={() => setDateModalVisible(false)}
            accessibilityRole="button"
            accessibilityLabel="Dismiss date picker"
          />
          <View
            style={[
              styles.dateModalSheet,
              { paddingBottom: Math.max(insets.bottom, 20) },
            ]}
          >
            <View style={styles.dateModalHeader}>
              <Text style={styles.dateModalTitle}>
                {dateField === 'from' ? 'Start' : 'End'} ·{' '}
                {MONTHS_SHORT[pickerMonth]} {pickerYear}
              </Text>
              <View style={styles.monthNav}>
                <Pressable
                  style={[
                    styles.monthNavButton,
                    !canGoPrevMonth && styles.monthNavButtonDisabled,
                  ]}
                  onPress={goToPrevMonth}
                  disabled={!canGoPrevMonth}
                  accessibilityRole="button"
                  accessibilityLabel="Previous month"
                  accessibilityState={{ disabled: !canGoPrevMonth }}
                >
                  <MaterialIcons
                    name="chevron-left"
                    size={isTablet ? 28 : 24}
                    color={
                      canGoPrevMonth
                        ? colors.textEnabled
                        : colors.textDisabled
                    }
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
              {pickerCells.map((cell) => {
                const selected = cell.key === selectedPickerKey;
                const disabled = isDateDisabled(cell.key);
                return (
                  <Pressable
                    key={cell.key}
                    style={styles.dayCell}
                    onPress={() => handleSelectDate(cell)}
                    disabled={disabled}
                    accessibilityRole="button"
                    accessibilityLabel={`Day ${cell.day}`}
                    accessibilityState={{ selected, disabled }}
                  >
                    <View
                      style={[
                        styles.dayNumberWrap,
                        selected && !disabled && styles.dayNumberWrapSelected,
                      ]}
                    >
                      <Text
                        style={[
                          styles.dayNumber,
                          !cell.inCurrentMonth && styles.dayNumberOutside,
                          disabled && styles.dayNumberDisabled,
                          selected && !disabled && styles.dayNumberSelected,
                        ]}
                      >
                        {cell.day}
                      </Text>
                    </View>
                  </Pressable>
                );
              })}
            </View>
          </View>
        </View>
      </Modal>

      <Modal
        visible={previewVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setPreviewVisible(false)}
      >
        <View style={styles.imagePreviewOverlay}>
          <Pressable
            style={[
              styles.imagePreviewClose,
              { top: Math.max(insets.top, 12) + 8 },
            ]}
            onPress={() => setPreviewVisible(false)}
            accessibilityRole="button"
            accessibilityLabel="Close image preview"
            hitSlop={8}
          >
            <MaterialIcons name="close" size={isTablet ? 28 : 26} color="#FFFFFF" />
          </Pressable>
          {attachment && isImageAttachment(attachment) ? (
            <Image
              source={{ uri: attachment.uri }}
              style={styles.imagePreviewFull}
              resizeMode="contain"
            />
          ) : null}
        </View>
      </Modal>
      <BottomSheet
        visible={attachModalVisible}
        title="Attach Document"
        subtitle="Choose file type"
        onClose={() => setAttachModalVisible(false)}
        options={[
          {
            key: 'photo',
            label: 'Photo',
            icon: 'image',
            onPress: () => {
              setAttachModalVisible(false);
              void pickPhotoAttachment();
            },
          },
          {
            key: 'pdf',
            label: 'PDF',
            icon: 'picture-as-pdf',
            iconColor: '#E53935',
            onPress: () => {
              setAttachModalVisible(false);
              void pickPdfAttachment();
            },
          },
        ]}
      />
    </SafeAreaView>
  );
};

export default TimeOffRequestScreen;
