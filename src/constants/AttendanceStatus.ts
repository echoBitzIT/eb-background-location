export type AttendanceDayStatus =
  | 'present'
  | 'absent'
  | 'leave'
  | 'half_day'
  | 'holiday'
  | 'weekly_off'
  | 'scheduled';

export const ATTENDANCE_STATUS_COLORS: Record<AttendanceDayStatus, string> = {
  present: '#22C55E',
  absent: '#EF4444',
  leave: '#22D3EE',
  half_day: '#2563EB',
  holiday: '#A855F7',
  weekly_off: '#6B21A8',
  scheduled: '#9CA3AF',
};

export const ATTENDANCE_STATUS_LABELS: Record<AttendanceDayStatus, string> = {
  present: 'Present',
  absent: 'Absent/Unpaid',
  leave: 'Approved Leave',
  half_day: 'Half Day',
  holiday: 'Holiday',
  weekly_off: 'Weekly Off',
  scheduled: 'Scheduled',
};

export const ATTENDANCE_LEGEND_ORDER: AttendanceDayStatus[] = [
  'present',
  'absent',
  'leave',
  'half_day',
  'holiday',
  'weekly_off',
];
