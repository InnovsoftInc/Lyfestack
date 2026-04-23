import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { exec } from 'child_process';
import { promisify } from 'util';
import cron from 'node-cron';
import { logger } from '../utils/logger';
import { OpenClawService } from '../integrations/openclaw/openclaw.service';

const execAsync = promisify(exec);

export interface CronJob {
  id: string;
  name: string;
  schedule: string;
  agent?: string;
  prompt?: string;
  command?: string;
  enabled: boolean;
  notify?: { channel: string };
  logPath?: string;
}

export interface RunRecord {
  jobId: string;
  startedAt: string;
  finishedAt?: string;
  status: 'running' | 'success' | 'error';
  error?: string;
}

const OPENCLAW_JSON = path.join(os.homedir(), '.openclaw', 'openclaw.json');
const RELOAD_INTERVAL_MS = 60_000;
const MAX_HISTORY = 1000;

class CronRunnerService {
  private jobs = new Map<string, CronJob>();
  private tasks = new Map<string, cron.ScheduledTask>();
  private schedules = new Map<string, string>();
  private history: RunRecord[] = [];
  private reloadTimer?: ReturnType<typeof setInterval>;
  private readonly openClawService = new OpenClawService();

  init(): void {
    this.loadAndSync();
    this.reloadTimer = setInterval(() => this.loadAndSync(), RELOAD_INTERVAL_MS);
    logger.info('[CronRunner] Started');
  }

  stop(): void {
    if (this.reloadTimer) clearInterval(this.reloadTimer);
    for (const task of this.tasks.values()) task.stop();
    this.tasks.clear();
    this.jobs.clear();
  }

  reload(): void {
    this.loadAndSync();
  }

  private readJobsFromDisk(): CronJob[] {
    try {
      const raw = fs.readFileSync(OPENCLAW_JSON, 'utf-8');
      const config = JSON.parse(raw) as { cron?: { jobs?: CronJob[] } };
      return config?.cron?.jobs ?? [];
    } catch {
      return [];
    }
  }

  private writeJobsToDisk(jobs: CronJob[]): void {
    const raw = fs.readFileSync(OPENCLAW_JSON, 'utf-8');
    const config = JSON.parse(raw) as Record<string, unknown>;
    if (!config.cron) config.cron = {};
    (config.cron as Record<string, unknown>).jobs = jobs;
    fs.writeFileSync(OPENCLAW_JSON, JSON.stringify(config, null, 2));
  }

  private loadAndSync(): void {
    const diskJobs = this.readJobsFromDisk();
    const diskIds = new Set(diskJobs.map((j) => j.id));

    // Stop tasks that were removed or disabled
    for (const [id, task] of this.tasks.entries()) {
      const diskJob = diskJobs.find((j) => j.id === id);
      if (!diskJob || !diskJob.enabled) {
        task.stop();
        this.tasks.delete(id);
        this.schedules.delete(id);
        logger.debug({ id }, '[CronRunner] Job stopped');
      }
    }

    // Clean up in-memory jobs that no longer exist on disk
    for (const id of this.jobs.keys()) {
      if (!diskIds.has(id)) this.jobs.delete(id);
    }

    let registered = 0;
    for (const job of diskJobs) {
      this.jobs.set(job.id, job);

      if (!job.enabled) continue;

      if (!cron.validate(job.schedule)) {
        logger.warn({ id: job.id, schedule: job.schedule }, '[CronRunner] Invalid cron expression — skipped');
        continue;
      }

      const existingTask = this.tasks.get(job.id);
      const scheduleChanged = this.schedules.get(job.id) !== job.schedule;

      if (existingTask && scheduleChanged) {
        existingTask.stop();
        this.tasks.delete(job.id);
        this.schedules.delete(job.id);
      }

      if (!this.tasks.has(job.id)) {
        const task = cron.schedule(job.schedule, () => {
          void this.runJob(job.id);
        });
        this.tasks.set(job.id, task);
        this.schedules.set(job.id, job.schedule);
        registered++;
        logger.debug({ id: job.id, schedule: job.schedule }, '[CronRunner] Job registered');
      }
    }

    if (registered > 0) {
      logger.info({ total: this.tasks.size, registered }, '[CronRunner] Jobs synced');
    }
  }

  async runJob(jobId: string): Promise<RunRecord> {
    const job = this.jobs.get(jobId) ?? this.readJobsFromDisk().find((j) => j.id === jobId);
    if (!job) throw new Error(`Job "${jobId}" not found`);

    const record: RunRecord = {
      jobId,
      startedAt: new Date().toISOString(),
      status: 'running',
    };
    this.history.unshift(record);
    if (this.history.length > MAX_HISTORY) this.history.length = MAX_HISTORY;

    const logFile = resolveLogPath(job.logPath ?? `~/Library/Logs/${job.id}.log`);
    const appendLog = (line: string) => {
      try {
        fs.mkdirSync(path.dirname(logFile), { recursive: true });
        fs.appendFileSync(logFile, `[${new Date().toISOString()}] ${line}\n`);
      } catch { /* best-effort */ }
    };

    logger.info({ jobId: job.id, name: job.name }, '[CronRunner] Running job');
    appendLog(`START ${job.name}`);

    try {
      let result: string;

      if (job.agent && job.prompt) {
        result = await this.openClawService.sendMessage(job.agent, job.prompt);
      } else if (job.command) {
        const { stdout } = await execAsync(job.command, { timeout: 300_000 });
        result = stdout.trim();
      } else {
        throw new Error('Job must have agent+prompt or command');
      }

      record.status = 'success';
      record.finishedAt = new Date().toISOString();
      appendLog(`OK  ${result.slice(0, 300)}`);
      logger.info({ jobId: job.id }, '[CronRunner] Job succeeded');
    } catch (err: unknown) {
      record.status = 'error';
      record.error = err instanceof Error ? err.message : String(err);
      record.finishedAt = new Date().toISOString();
      appendLog(`ERR ${record.error}`);
      logger.error({ jobId: job.id, err: record.error }, '[CronRunner] Job failed');
    }

    return record;
  }

  getHistory(jobId?: string): RunRecord[] {
    if (jobId) return this.history.filter((r) => r.jobId === jobId);
    return [...this.history];
  }

  getJob(jobId: string): CronJob | undefined {
    return this.jobs.get(jobId) ?? this.readJobsFromDisk().find((j) => j.id === jobId);
  }

  getAllJobs(): CronJob[] {
    return this.readJobsFromDisk();
  }

  upsertJob(job: CronJob): void {
    const jobs = this.readJobsFromDisk();
    const idx = jobs.findIndex((j) => j.id === job.id);
    if (idx === -1) {
      jobs.push(job);
    } else {
      jobs[idx] = job;
    }
    this.writeJobsToDisk(jobs);
    this.loadAndSync();
  }

  deleteJob(jobId: string): void {
    const jobs = this.readJobsFromDisk().filter((j) => j.id !== jobId);
    this.writeJobsToDisk(jobs);
    const task = this.tasks.get(jobId);
    if (task) {
      task.stop();
      this.tasks.delete(jobId);
      this.schedules.delete(jobId);
      this.jobs.delete(jobId);
    }
  }

  setEnabled(jobId: string, enabled: boolean): CronJob | null {
    const jobs = this.readJobsFromDisk();
    const job = jobs.find((j) => j.id === jobId);
    if (!job) return null;
    job.enabled = enabled;
    this.writeJobsToDisk(jobs);
    this.loadAndSync();
    return job;
  }

  getLastRun(jobId: string): RunRecord | undefined {
    return this.history.find((r) => r.jobId === jobId && r.status !== 'running');
  }
}

function resolveLogPath(p: string): string {
  return p.startsWith('~/') ? path.join(os.homedir(), p.slice(2)) : p;
}

export const cronRunner = new CronRunnerService();
