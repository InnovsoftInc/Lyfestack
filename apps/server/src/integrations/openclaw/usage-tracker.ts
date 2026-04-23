import * as fs from 'fs/promises';
import * as path from 'path';
import { logger } from '../../utils/logger';

const USAGE_FILE = path.join(process.env.HOME ?? '', '.openclaw', 'lyfestack-usage.json');

export interface UsageEntry {
  timestamp: string;
  agentName: string;
  model: string;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  estimatedCost: number;
  durationMs: number;
}

interface UsageData {
  entries: UsageEntry[];
}

const MODEL_COSTS: Record<string, { input: number; output: number }> = {
  'anthropic/claude-sonnet-4': { input: 3, output: 15 },
  'anthropic/claude-haiku-4': { input: 0.25, output: 1.25 },
  'openai/gpt-4o': { input: 2.5, output: 10 },
  'openai/gpt-4o-mini': { input: 0.15, output: 0.6 },
  'openrouter/auto': { input: 1, output: 5 },
};

function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

function estimateCost(model: string, promptTokens: number, completionTokens: number): number {
  const costs = MODEL_COSTS[model] ?? { input: 1, output: 5 };
  return ((promptTokens / 1_000_000) * costs.input) + ((completionTokens / 1_000_000) * costs.output);
}

async function readUsage(): Promise<UsageData> {
  try {
    const raw = await fs.readFile(USAGE_FILE, 'utf-8');
    return JSON.parse(raw);
  } catch {
    return { entries: [] };
  }
}

async function writeUsage(data: UsageData): Promise<void> {
  await fs.mkdir(path.dirname(USAGE_FILE), { recursive: true });
  // Keep only last 10000 entries
  if (data.entries.length > 10000) data.entries = data.entries.slice(-10000);
  await fs.writeFile(USAGE_FILE, JSON.stringify(data, null, 2));
}

export async function trackUsage(agentName: string, model: string, prompt: string, response: string, durationMs: number): Promise<void> {
  try {
    const data = await readUsage();
    const promptTokens = estimateTokens(prompt);
    const completionTokens = estimateTokens(response);
    data.entries.push({
      timestamp: new Date().toISOString(),
      agentName,
      model,
      promptTokens,
      completionTokens,
      totalTokens: promptTokens + completionTokens,
      estimatedCost: estimateCost(model, promptTokens, completionTokens),
      durationMs,
    });
    await writeUsage(data);
  } catch (err) {
    logger.error({ err }, 'Failed to track usage');
  }
}

function filterByPeriod(entries: UsageEntry[], period: 'today' | 'week' | 'month'): UsageEntry[] {
  const now = new Date();
  const cutoff = new Date();
  if (period === 'today') cutoff.setHours(0, 0, 0, 0);
  else if (period === 'week') cutoff.setDate(now.getDate() - 7);
  else cutoff.setDate(now.getDate() - 30);
  return entries.filter(e => new Date(e.timestamp) >= cutoff);
}

function summarize(entries: UsageEntry[]) {
  return {
    requests: entries.length,
    totalTokens: entries.reduce((sum, e) => sum + e.totalTokens, 0),
    estimatedCost: Math.round(entries.reduce((sum, e) => sum + e.estimatedCost, 0) * 10000) / 10000,
  };
}

export async function getUsageSummary() {
  const { entries } = await readUsage();
  return {
    today: summarize(filterByPeriod(entries, 'today')),
    week: summarize(filterByPeriod(entries, 'week')),
    month: summarize(filterByPeriod(entries, 'month')),
  };
}

export async function getUsageHistory(limit = 100) {
  const { entries } = await readUsage();
  return entries.slice(-limit).reverse();
}

export async function getUsageByAgent() {
  const { entries } = await readUsage();
  const month = filterByPeriod(entries, 'month');
  const grouped: Record<string, { requests: number; tokens: number; cost: number }> = {};
  for (const e of month) {
    if (!grouped[e.agentName]) grouped[e.agentName] = { requests: 0, tokens: 0, cost: 0 };
    grouped[e.agentName].requests++;
    grouped[e.agentName].tokens += e.totalTokens;
    grouped[e.agentName].cost += e.estimatedCost;
  }
  return Object.entries(grouped).map(([agent, stats]) => ({ agent, ...stats, cost: Math.round(stats.cost * 10000) / 10000 })).sort((a, b) => b.requests - a.requests);
}

export async function getUsageByModel() {
  const { entries } = await readUsage();
  const month = filterByPeriod(entries, 'month');
  const grouped: Record<string, { requests: number; tokens: number; cost: number }> = {};
  for (const e of month) {
    if (!grouped[e.model]) grouped[e.model] = { requests: 0, tokens: 0, cost: 0 };
    grouped[e.model].requests++;
    grouped[e.model].tokens += e.totalTokens;
    grouped[e.model].cost += e.estimatedCost;
  }
  return Object.entries(grouped).map(([model, stats]) => ({ model, ...stats, cost: Math.round(stats.cost * 10000) / 10000 })).sort((a, b) => b.requests - a.requests);
}
