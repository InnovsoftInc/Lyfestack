import fs from 'fs';
import path from 'path';
import os from 'os';
import { v4 as uuidv4 } from 'uuid';
import cron from 'node-cron';
import { logger } from '../utils/logger';

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

interface RoutinesData {
  routines: Routine[];
  history: RunRecord[];
}

const DATA_DIR = path.join(os.homedir(), '.openclaw');
const DATA_FILE = path.join(DATA_DIR, 'lyfestack-routines.json');
const MAX_HISTORY_PER_ROUTINE = 10;

function ensureDataDir(): void {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
}

function loadData(): RoutinesData {
  ensureDataDir();
  if (!fs.existsSync(DATA_FILE)) return { routines: [], history: [] };
  try {
    return JSON.parse(fs.readFileSync(DATA_FILE, 'utf-8')) as RoutinesData;
  } catch {
    return { routines: [], history: [] };
  }
}

function saveData(data: RoutinesData): void {
  ensureDataDir();
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2), 'utf-8');
}

function computeNextRun(schedule: string): string | undefined {
  // Best-effort next-run from common cron patterns
  const now = new Date();
  const parts = schedule.trim().split(/\s+/);
  if (parts.length !== 5) return undefined;
  const [min, hour, dom, , dow] = parts;

  try {
    const next = new Date(now);
    next.setSeconds(0, 0);

    if (min !== '*' && hour !== '*' && dom === '*' && dow === '*') {
      // Daily at fixed time e.g. "0 8 * * *"
      next.setHours(Number(hour), Number(min), 0, 0);
      if (next <= now) next.setDate(next.getDate() + 1);
      return next.toISOString();
    }

    if (min !== '*' && hour !== '*' && dow !== '*' && dom === '*') {
      // Weekly on specific day e.g. "0 8 * * 1"
      const targetDow = Number(dow);
      next.setHours(Number(hour), Number(min), 0, 0);
      const daysAhead = (targetDow - next.getDay() + 7) % 7 || 7;
      next.setDate(next.getDate() + (next <= now ? daysAhead : daysAhead - 1));
      return next.toISOString();
    }

    if (min !== '*' && hour === '*') {
      // Every hour at minute e.g. "0 * * * *"
      next.setMinutes(Number(min), 0, 0);
      if (next <= now) next.setHours(next.getHours() + 1);
      return next.toISOString();
    }
  } catch {
    // Ignore parse errors
  }
  return undefined;
}

class RoutinesService {
  private scheduledTasks = new Map<string, cron.ScheduledTask>();

  init(): void {
    const data = loadData();
    for (const routine of data.routines) {
      if (routine.enabled) this.register(routine);
    }
    logger.info({ count: data.routines.filter((r) => r.enabled).length }, '[RoutinesService] Initialized');
  }

  private register(routine: Routine): void {
    this.unregister(routine.id);
    if (!cron.validate(routine.schedule)) {
      logger.warn({ id: routine.id, schedule: routine.schedule }, '[RoutinesService] Invalid cron — skipping');
      return;
    }
    const task = cron.schedule(routine.schedule, () => {
      void this.executeRoutine(routine.id);
    });
    this.scheduledTasks.set(routine.id, task);
  }

  private unregister(id: string): void {
    const existing = this.scheduledTasks.get(id);
    if (existing) {
      existing.stop();
      this.scheduledTasks.delete(id);
    }
  }

  private async executeRoutine(id: string): Promise<RunRecord> {
    const data = loadData();
    const routine = data.routines.find((r) => r.id === id);
    if (!routine) throw new Error(`Routine ${id} not found`);

    const record: RunRecord = {
      id: uuidv4(),
      routineId: id,
      startedAt: new Date().toISOString(),
      status: 'running',
    };

    logger.info({ routineId: id, agent: routine.agentName }, '[RoutinesService] Executing routine');

    try {
      // Execute via OpenClaw agent
      const { OpenClawService } = await import('../integrations/openclaw/openclaw.service');
      const openclawService = new OpenClawService();
      const output = await openclawService.sendMessage(routine.agentName, routine.prompt);

      record.status = 'success';
      record.completedAt = new Date().toISOString();
      record.output = output;
    } catch (err) {
      record.status = 'error';
      record.completedAt = new Date().toISOString();
      record.error = err instanceof Error ? err.message : String(err);
      logger.warn({ routineId: id, err }, '[RoutinesService] Routine execution failed');
    }

    // Persist run record and update lastRun/nextRun
    const freshData = loadData();
    const idx = freshData.routines.findIndex((r) => r.id === id);
    if (idx !== -1) {
      freshData.routines[idx].lastRun = record.startedAt;
      freshData.routines[idx].nextRun = computeNextRun(routine.schedule);
      freshData.routines[idx].updatedAt = new Date().toISOString();
    }
    freshData.history = [record, ...freshData.history.filter((h) => h.routineId !== id || true)];
    // Prune history — keep last MAX_HISTORY_PER_ROUTINE per routine
    const byRoutine = new Map<string, RunRecord[]>();
    for (const h of freshData.history) {
      const list = byRoutine.get(h.routineId) ?? [];
      if (list.length < MAX_HISTORY_PER_ROUTINE) {
        list.push(h);
        byRoutine.set(h.routineId, list);
      }
    }
    freshData.history = [...byRoutine.values()].flat();
    saveData(freshData);

    return record;
  }

  listRoutines(): Routine[] {
    return loadData().routines;
  }

  createRoutine(config: Omit<Routine, 'id' | 'createdAt' | 'updatedAt'>): Routine {
    if (!config.name?.trim()) throw new Error('name is required');
    if (!config.schedule?.trim()) throw new Error('schedule is required');
    if (!cron.validate(config.schedule)) throw new Error('Invalid cron expression');
    if (!config.agentName?.trim()) throw new Error('agentName is required');
    if (!config.prompt?.trim()) throw new Error('prompt is required');

    const now = new Date().toISOString();
    const routine: Routine = {
      id: uuidv4(),
      name: config.name.trim(),
      description: config.description?.trim() ?? '',
      schedule: config.schedule.trim(),
      agentName: config.agentName.trim(),
      prompt: config.prompt.trim(),
      enabled: config.enabled ?? true,
      nextRun: computeNextRun(config.schedule.trim()),
      createdAt: now,
      updatedAt: now,
    };

    const data = loadData();
    data.routines.push(routine);
    saveData(data);

    if (routine.enabled) this.register(routine);
    return routine;
  }

  updateRoutine(id: string, updates: Partial<Omit<Routine, 'id' | 'createdAt'>>): Routine {
    const data = loadData();
    const idx = data.routines.findIndex((r) => r.id === id);
    if (idx === -1) throw new Error(`Routine ${id} not found`);

    if (updates.schedule && !cron.validate(updates.schedule)) {
      throw new Error('Invalid cron expression');
    }

    const updated: Routine = {
      ...data.routines[idx],
      ...updates,
      id,
      createdAt: data.routines[idx].createdAt,
      updatedAt: new Date().toISOString(),
    };
    if (updates.schedule) updated.nextRun = computeNextRun(updates.schedule);
    data.routines[idx] = updated;
    saveData(data);

    if (updated.enabled) {
      this.register(updated);
    } else {
      this.unregister(id);
    }
    return updated;
  }

  deleteRoutine(id: string): void {
    const data = loadData();
    const idx = data.routines.findIndex((r) => r.id === id);
    if (idx === -1) throw new Error(`Routine ${id} not found`);
    data.routines.splice(idx, 1);
    data.history = data.history.filter((h) => h.routineId !== id);
    saveData(data);
    this.unregister(id);
  }

  toggleRoutine(id: string): Routine {
    const data = loadData();
    const routine = data.routines.find((r) => r.id === id);
    if (!routine) throw new Error(`Routine ${id} not found`);
    return this.updateRoutine(id, { enabled: !routine.enabled });
  }

  async runNow(id: string): Promise<RunRecord> {
    const data = loadData();
    if (!data.routines.find((r) => r.id === id)) throw new Error(`Routine ${id} not found`);
    return this.executeRoutine(id);
  }

  getRunHistory(id: string): RunRecord[] {
    const data = loadData();
    return data.history.filter((h) => h.routineId === id);
  }
}

export const routinesService = new RoutinesService();
