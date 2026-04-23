import * as fs from 'fs/promises';
import * as path from 'path';

const USAGE_FILE = path.join(process.env.HOME ?? '', '.openclaw', 'lyfestack-usage.json');

export interface UsageEntry {
  id: string;
  timestamp: string;
  agentName: string;
  model: string;
  promptTokens: number;
  completionTokens: number;
  cost: number;
  duration: number;
}

export interface UsageSummary {
  requests: number;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  cost: number;
}

export interface AgentUsage extends UsageSummary {
  agentName: string;
}

export interface ModelUsage extends UsageSummary {
  model: string;
}

const MODEL_COSTS: Array<[string, { input: number; output: number }]> = [
  ['claude-opus-4', { input: 0.000015, output: 0.000075 }],
  ['claude-sonnet-4', { input: 0.000003, output: 0.000015 }],
  ['claude-3-5-sonnet', { input: 0.000003, output: 0.000015 }],
  ['claude-3.5-sonnet', { input: 0.000003, output: 0.000015 }],
  ['claude-3-haiku', { input: 0.00000025, output: 0.00000125 }],
  ['claude-3-opus', { input: 0.000015, output: 0.000075 }],
  ['gpt-4o', { input: 0.0000025, output: 0.00001 }],
  ['gpt-4', { input: 0.00003, output: 0.00006 }],
  ['gpt-3.5', { input: 0.0000005, output: 0.0000015 }],
];

function getModelCost(model: string): { input: number; output: number } {
  const lower = model.toLowerCase();
  for (const [key, costs] of MODEL_COSTS) {
    if (lower.includes(key)) return costs;
  }
  return { input: 0.000003, output: 0.000015 };
}

class UsageTracker {
  private entries: UsageEntry[] = [];
  private loaded = false;
  private saveTimer: NodeJS.Timeout | null = null;

  private async load(): Promise<void> {
    if (this.loaded) return;
    try {
      const raw = await fs.readFile(USAGE_FILE, 'utf-8');
      this.entries = JSON.parse(raw);
    } catch { /* first run or file missing */ }
    this.loaded = true;
  }

  private scheduleSave(): void {
    if (this.saveTimer) return;
    this.saveTimer = setTimeout(() => {
      this.saveTimer = null;
      this.persist().catch(() => {});
    }, 2000);
  }

  private async persist(): Promise<void> {
    try {
      await fs.mkdir(path.dirname(USAGE_FILE), { recursive: true });
      await fs.writeFile(USAGE_FILE, JSON.stringify(this.entries.slice(-1000), null, 2));
    } catch { /* best-effort */ }
  }

  async track(params: {
    agentName: string;
    model: string;
    message: string;
    response: string;
    duration: number;
  }): Promise<void> {
    await this.load();
    const promptTokens = Math.ceil(params.message.length / 4);
    const completionTokens = Math.ceil(params.response.length / 4);
    const { input, output } = getModelCost(params.model);
    this.entries.push({
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      timestamp: new Date().toISOString(),
      agentName: params.agentName,
      model: params.model,
      promptTokens,
      completionTokens,
      cost: promptTokens * input + completionTokens * output,
      duration: params.duration,
    });
    this.scheduleSave();
  }

  private summarize(entries: UsageEntry[]): UsageSummary {
    return entries.reduce(
      (acc, e) => ({
        requests: acc.requests + 1,
        promptTokens: acc.promptTokens + e.promptTokens,
        completionTokens: acc.completionTokens + e.completionTokens,
        totalTokens: acc.totalTokens + e.promptTokens + e.completionTokens,
        cost: acc.cost + e.cost,
      }),
      { requests: 0, promptTokens: 0, completionTokens: 0, totalTokens: 0, cost: 0 }
    );
  }

  async getTodayUsage(): Promise<UsageSummary> {
    await this.load();
    const today = new Date().toISOString().slice(0, 10);
    return this.summarize(this.entries.filter((e) => e.timestamp.startsWith(today)));
  }

  async getWeeklyUsage(): Promise<UsageSummary> {
    await this.load();
    const cutoff = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    return this.summarize(this.entries.filter((e) => e.timestamp >= cutoff));
  }

  async getMonthlyUsage(): Promise<UsageSummary> {
    await this.load();
    const cutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    return this.summarize(this.entries.filter((e) => e.timestamp >= cutoff));
  }

  async getRecent(limit = 100): Promise<UsageEntry[]> {
    await this.load();
    return [...this.entries].reverse().slice(0, limit);
  }

  async getByAgent(): Promise<AgentUsage[]> {
    await this.load();
    const map = new Map<string, UsageEntry[]>();
    for (const e of this.entries) {
      const bucket = map.get(e.agentName) ?? [];
      bucket.push(e);
      map.set(e.agentName, bucket);
    }
    return Array.from(map.entries())
      .map(([agentName, es]) => ({ agentName, ...this.summarize(es) }))
      .sort((a, b) => b.requests - a.requests);
  }

  async getByModel(): Promise<ModelUsage[]> {
    await this.load();
    const map = new Map<string, UsageEntry[]>();
    for (const e of this.entries) {
      const bucket = map.get(e.model) ?? [];
      bucket.push(e);
      map.set(e.model, bucket);
    }
    return Array.from(map.entries())
      .map(([model, es]) => ({ model, ...this.summarize(es) }))
      .sort((a, b) => b.requests - a.requests);
  }
}

export const usageTracker = new UsageTracker();
