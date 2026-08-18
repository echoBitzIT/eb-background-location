import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEY = '@geo_employee_tracker/task_progress';

export type TaskProgress = {
  point_uuid?: string;
  stop_uuid?: string;
  stop_id?: number;
  checklist_done?: number[];
  image_uuids?: string[];
  /** Dedicated UUID for Done/complete GPS point; never reuse Start's point_uuid. */
  complete_point_uuid?: string;
  /** Dedicated UUID for Pause GPS point; never reuse Start's point_uuid. */
  pause_point_uuid?: string;
};

type TaskProgressMap = Record<string, TaskProgress>;

async function readAll(): Promise<TaskProgressMap> {
  const raw = await AsyncStorage.getItem(STORAGE_KEY);
  if (!raw) {
    return {};
  }
  try {
    const parsed = JSON.parse(raw) as TaskProgressMap;
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

async function writeAll(map: TaskProgressMap): Promise<void> {
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(map));
}

export async function loadTaskProgress(
  taskId: number,
): Promise<TaskProgress> {
  const map = await readAll();
  return map[String(taskId)] ?? {};
}

export async function saveTaskProgress(
  taskId: number,
  patch: Partial<TaskProgress>,
): Promise<TaskProgress> {
  const map = await readAll();
  const key = String(taskId);
  const next: TaskProgress = { ...(map[key] ?? {}), ...patch };
  map[key] = next;
  await writeAll(map);
  return next;
}

export async function clearTaskProgress(taskId: number): Promise<void> {
  const map = await readAll();
  delete map[String(taskId)];
  await writeAll(map);
}

/** UTC `YYYY-MM-DD HH:MM:SS` for Odoo field timestamps. */
export function formatOdooDeviceTimestamp(date = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return (
    `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())} ` +
    `${pad(date.getUTCHours())}:${pad(date.getUTCMinutes())}:${pad(date.getUTCSeconds())}`
  );
}
