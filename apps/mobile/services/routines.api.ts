import { request } from './api';

export interface Routine {
  id: string;
  name: string;
  description: string;
  schedule: string;
  agentName: string;
  prompt: string;
  enabled: boolean;
  lastRun?: string;
  nextRun?: string;
  createdAt: string;
  updatedAt: string;
}

export interface RunRecord {
  id: string;
  routineId: string;
  startedAt: string;
  completedAt?: string;
  status: 'running' | 'success' | 'error';
  output?: string;
  error?: string;
}

export interface CreateRoutinePayload {
  name: string;
  description?: string;
  schedule: string;
  agentName: string;
  prompt: string;
  enabled?: boolean;
}

const COMMON_SCHEDULES: Record<string, string> = {
  '0 8 * * *':   'Every morning at 8am',
  '0 20 * * *':  'Every evening at 8pm',
  '0 * * * *':   'Every hour',
  '0 9 * * 1':   'Every Monday at 9am',
  '0 9 * * 1-5': 'Weekdays at 9am',
  '0 8 * * 0':   'Every Sunday at 8am',
  '0 0 * * *':   'Daily at midnight',
  '*/30 * * * *':'Every 30 minutes',
};

export function humanizeCron(expr: string): string {
  if (COMMON_SCHEDULES[expr]) return COMMON_SCHEDULES[expr];
  const parts = expr.trim().split(/\s+/);
  if (parts.length !== 5) return expr;
  const [min, hour, , , dow] = parts;
  try {
    const minNum = min === '*' ? null : Number(min);
    const hourNum = hour === '*' ? null : Number(hour);
    const timeStr = hourNum !== null && minNum !== null
      ? `${hourNum % 12 || 12}:${String(minNum).padStart(2, '0')} ${hourNum < 12 ? 'am' : 'pm'}`
      : null;

    if (dow !== '*' && timeStr) {
      const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
      const dayNum = Number(dow);
      if (!isNaN(dayNum) && dayNum >= 0 && dayNum <= 6) {
        return `Every ${dayNames[dayNum]} at ${timeStr}`;
      }
    }
    if (timeStr && dow === '*') return `Daily at ${timeStr}`;
    if (hourNum === null && minNum !== null) return `Every hour at :${String(minNum).padStart(2, '0')}`;
  } catch {
    // Fall through
  }
  return expr;
}

export function formatRelativeTime(iso?: string): string {
  if (!iso) return 'Never';
  const diff = Date.now() - new Date(iso).getTime();
  const secs = Math.floor(diff / 1000);
  if (secs < 60) return 'Just now';
  const mins = Math.floor(secs / 60);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

export function formatNextRun(iso?: string): string {
  if (!iso) return 'Unknown';
  const diff = new Date(iso).getTime() - Date.now();
  if (diff < 0) return 'Soon';
  const secs = Math.floor(diff / 1000);
  const mins = Math.floor(secs / 60);
  if (mins < 60) return `In ${mins}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `In ${hrs}h`;
  const days = Math.floor(hrs / 24);
  return `In ${days}d`;
}

export const routinesApi = {
  list: () =>
    request<{ routines: Routine[] }>('/api/routines').then((r) => r.routines),

  create: (payload: CreateRoutinePayload) =>
    request<{ routine: Routine }>('/api/routines', {
      method: 'POST',
      body: payload,
    }).then((r) => r.routine),

  update: (id: string, updates: Partial<CreateRoutinePayload>) =>
    request<{ routine: Routine }>(`/api/routines/${id}`, {
      method: 'PATCH',
      body: updates,
    }).then((r) => r.routine),

  delete: (id: string) =>
    request<{ ok: boolean }>(`/api/routines/${id}`, { method: 'DELETE' }),

  toggle: (id: string) =>
    request<{ routine: Routine }>(`/api/routines/${id}/toggle`, {
      method: 'POST',
    }).then((r) => r.routine),

  runNow: (id: string) =>
    request<{ record: RunRecord }>(`/api/routines/${id}/run`, {
      method: 'POST',
    }).then((r) => r.record),

  history: (id: string) =>
    request<{ history: RunRecord[] }>(`/api/routines/${id}/history`).then((r) => r.history),
};

export const SCHEDULE_PRESETS = [
  { label: 'Every morning (8am)', value: '0 8 * * *' },
  { label: 'Every evening (8pm)', value: '0 20 * * *' },
  { label: 'Every hour', value: '0 * * * *' },
  { label: 'Every day at midnight', value: '0 0 * * *' },
  { label: 'Weekdays at 9am', value: '0 9 * * 1-5' },
  { label: 'Every Monday at 9am', value: '0 9 * * 1' },
  { label: 'Every Sunday at 8am', value: '0 8 * * 0' },
  { label: 'Every 30 minutes', value: '*/30 * * * *' },
  { label: 'Custom (cron expression)', value: 'custom' },
] as const;
