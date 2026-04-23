import * as fs from 'fs/promises';
import * as path from 'path';
import cron from 'node-cron';
import { exec } from 'child_process';
import { promisify } from 'util';
import { logger } from '../utils/logger';

const execAsync = promisify(exec);
const OPENCLAW_CONFIG = path.join(process.env.HOME ?? '', '.openclaw');
const AUTOMATIONS_FILE = path.join(OPENCLAW_CONFIG, 'automations.json');

export interface Automation {
  id: string;
  name: string;
  agentName: string;
  cronExpression: string;
  scheduleLabel: string;
  message: string;
  enabled: boolean;
  createdAt: string;
  lastRunAt?: string;
  nextRunAt?: string;
  lastResult?: string;
}

const activeTasks = new Map<string, cron.ScheduledTask>();

async function readAutomations(): Promise<Automation[]> {
  try {
    const raw = await fs.readFile(AUTOMATIONS_FILE, 'utf-8');
    return JSON.parse(raw) as Automation[];
  } catch {
    return [];
  }
}

async function writeAutomations(automations: Automation[]): Promise<void> {
  await fs.mkdir(OPENCLAW_CONFIG, { recursive: true });
  await fs.writeFile(AUTOMATIONS_FILE, JSON.stringify(automations, null, 2));
}

export class AutomationsService {
  async list(): Promise<Automation[]> {
    return readAutomations();
  }

  async create(data: {
    name: string;
    agentName: string;
    cronExpression: string;
    scheduleLabel: string;
    message: string;
    enabled?: boolean;
  }): Promise<Automation> {
    const automations = await readAutomations();
    const automation: Automation = {
      id: `auto-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      name: data.name,
      agentName: data.agentName,
      cronExpression: data.cronExpression,
      scheduleLabel: data.scheduleLabel,
      message: data.message,
      enabled: data.enabled ?? true,
      createdAt: new Date().toISOString(),
    };
    automations.push(automation);
    await writeAutomations(automations);
    if (automation.enabled) this.scheduleTask(automation);
    logger.info({ id: automation.id, name: automation.name }, 'Automation created');
    return automation;
  }

  async delete(id: string): Promise<void> {
    const automations = await readAutomations();
    const filtered = automations.filter((a) => a.id !== id);
    await writeAutomations(filtered);
    this.unscheduleTask(id);
    logger.info({ id }, 'Automation deleted');
  }

  async toggle(id: string, enabled: boolean): Promise<Automation | null> {
    const automations = await readAutomations();
    const idx = automations.findIndex((a) => a.id === id);
    if (idx === -1) return null;
    automations[idx]!.enabled = enabled;
    await writeAutomations(automations);
    if (enabled) {
      this.scheduleTask(automations[idx]!);
    } else {
      this.unscheduleTask(id);
    }
    logger.info({ id, enabled }, 'Automation toggled');
    return automations[idx]!;
  }

  async runNow(id: string): Promise<{ result: string }> {
    const automations = await readAutomations();
    const automation = automations.find((a) => a.id === id);
    if (!automation) throw new Error('Automation not found');
    const result = await this.execute(automation);
    return { result };
  }

  private async execute(automation: Automation): Promise<string> {
    try {
      const escaped = automation.message.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
      const { stdout } = await execAsync(
        `/bin/bash -c "openclaw agent --agent ${automation.agentName} -m \\"${escaped}\\""`,
        { timeout: 120000, env: process.env },
      );
      const result = stdout.trim();

      const automations = await readAutomations();
      const idx = automations.findIndex((a) => a.id === automation.id);
      if (idx !== -1) {
        automations[idx]!.lastRunAt = new Date().toISOString();
        automations[idx]!.lastResult = result.slice(0, 300);
        await writeAutomations(automations);
      }
      logger.info({ id: automation.id }, 'Automation executed successfully');
      return result;
    } catch (err: any) {
      logger.error({ id: automation.id, err: err.message }, 'Automation execution failed');
      throw new Error(`Automation failed: ${err.message}`);
    }
  }

  private scheduleTask(automation: Automation): void {
    if (!automation.enabled) return;
    if (!cron.validate(automation.cronExpression)) {
      logger.warn({ id: automation.id, cron: automation.cronExpression }, 'Invalid cron expression');
      return;
    }
    this.unscheduleTask(automation.id);
    const task = cron.schedule(automation.cronExpression, async () => {
      logger.info({ id: automation.id, name: automation.name }, 'Running scheduled automation');
      await this.execute(automation).catch((err) =>
        logger.error({ id: automation.id, err: err.message }, 'Scheduled automation failed'),
      );
    });
    activeTasks.set(automation.id, task);
  }

  private unscheduleTask(id: string): void {
    const task = activeTasks.get(id);
    if (task) {
      task.stop();
      activeTasks.delete(id);
    }
  }

  async init(): Promise<void> {
    const automations = await readAutomations();
    const enabled = automations.filter((a) => a.enabled);
    for (const auto of enabled) this.scheduleTask(auto);
    logger.info({ count: enabled.length }, 'Automations initialized');
  }
}

export const automationsService = new AutomationsService();
