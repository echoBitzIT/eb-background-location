import {
  fetchFieldTasks,
  type FieldTask,
  type FieldTaskPauseReason,
} from '../services/apiClient';
import { stopLocationTracking } from '../services/locationTrackingService';

export type TaskBadgeVariant =
  | 'completed'
  | 'overdue'
  | 'upcoming'
  | 'pending'
  | 'active'
  | 'paused';

const STATUS_LABEL: Record<string, string> = {
  pending: 'Pending',
  active: 'Active',
  paused: 'Paused',
  completed: 'Completed',
  cancelled: 'Cancelled',
  draft: 'Draft',
};

const ADMIN_PAUSE_LABELS: Record<string, string> = {
  admin_close: 'Session force-closed by admin',
};

/** Display badge: completed → overdue → upcoming → status. */
export function resolveTaskBadge(task: {
  status: string;
  is_overdue?: boolean;
  is_upcoming?: boolean;
}): { label: string; variant: TaskBadgeVariant } {
  if (task.status === 'completed') {
    return { label: 'Completed', variant: 'completed' };
  }
  if (task.is_overdue) {
    return { label: 'Overdue', variant: 'overdue' };
  }
  if (task.is_upcoming) {
    return { label: 'Upcoming', variant: 'upcoming' };
  }
  if (task.status === 'active') {
    return { label: 'Active', variant: 'active' };
  }
  if (task.status === 'paused') {
    return { label: 'Paused', variant: 'paused' };
  }
  return {
    label: STATUS_LABEL[task.status] ?? 'Pending',
    variant: 'pending',
  };
}

export function isTaskStartBlocked(task: {
  status: string;
  is_upcoming?: boolean;
}): boolean {
  return Boolean(task.is_upcoming) && task.status !== 'completed';
}

export function pauseReasonLabel(
  value: string | false | null | undefined,
  reasons?: FieldTaskPauseReason[],
): string | null {
  if (typeof value !== 'string' || !value.trim()) {
    return null;
  }
  const fromList = reasons?.find((reason) => reason.value === value);
  if (fromList?.label) {
    return fromList.label;
  }
  return ADMIN_PAUSE_LABELS[value] ?? value;
}

export function formatPauseReasonLine(
  task: Pick<FieldTask, 'pause_reason' | 'pause_note'> & {
    pause_reasons?: FieldTaskPauseReason[];
  },
): string | null {
  const label = pauseReasonLabel(task.pause_reason, task.pause_reasons);
  if (!label) {
    return null;
  }
  const note =
    typeof task.pause_note === 'string' && task.pause_note.trim()
      ? task.pause_note.trim()
      : null;
  return note ? `${label}: ${note}` : label;
}

/** Stop GPS when complete/cancel closed the tracking session. Keep attendance. */
export async function syncTrackingAfterTaskTerminal(
  accessToken: string,
): Promise<void> {
  try {
    const result = await fetchFieldTasks(accessToken, {
      limit: 1,
      date_field: 'calendar',
    });
    const sessionGone =
      result.session_id === false || result.session_state === 'completed';
    if (sessionGone) {
      await stopLocationTracking();
    }
  } catch {
    // Upload loop still stops itself on FT_NO_ACTIVE_SESSION / FT_SESSION_CLOSED.
  }
}
