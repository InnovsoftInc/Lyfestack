import { v4 as uuid } from 'uuid';
import type { DailyBrief, Task } from '@lyfestack/shared';
import { chatCompletion } from '../integrations/openrouter/openrouter.client';
import { logger } from '../utils/logger';

export interface GenerateBriefOptions {
  userId: string;
  date: string;
  tasks: Task[];
  goals?: Array<{ title: string; progressScore: number }> | undefined;
  userName?: string | undefined;
}

interface BriefLLMResponse {
  summary: string;
  insights: string[];
}

const DEFAULT_SUMMARY =
  "Here's what you're working on today. Stay focused and keep building momentum.";

const DEFAULT_INSIGHTS = [
  'Start with your most important task first.',
  'Track your progress as you go — small wins add up.',
  'If you feel stuck, break tasks into smaller steps.',
];

export async function generateDailyBrief(options: GenerateBriefOptions): Promise<DailyBrief> {
  const { userId, date, tasks, goals = [], userName } = options;

  const greeting = buildGreeting(userName);
  let summary = DEFAULT_SUMMARY;
  let insights = DEFAULT_INSIGHTS;

  const taskSummary = tasks.map((t) => `- [${t.type}] ${t.title}`).join('\n');
  const goalSummary = goals.map((g) => `- ${g.title} (${g.progressScore}% complete)`).join('\n');

  try {
    const systemPrompt = `You are a personal productivity coach generating a daily brief. Be encouraging, concise, and actionable. Respond with valid JSON only.

Schema: { "summary": "string — 1-2 sentence motivating day overview", "insights": ["string — 2-3 personalized tips"] }`;

    const userMessage = `Generate a daily brief for ${date}.
User: ${userName ?? 'User'}
Active goals:\n${goalSummary || 'No active goals yet.'}
Today's tasks:\n${taskSummary || 'No tasks scheduled.'}`;

    const raw = await chatCompletion(
      [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userMessage },
      ],
      { temperature: 0.7, maxTokens: 500 },
    );

    const parsed = JSON.parse(raw) as BriefLLMResponse;
    summary = parsed.summary ?? summary;
    insights = parsed.insights ?? insights;
  } catch (err) {
    logger.warn({ err }, 'Brief LLM generation failed, using defaults');
  }

  return {
    id: uuid(),
    userId,
    date,
    greeting,
    summary,
    tasks,
    insights,
    generatedAt: new Date().toISOString(),
  };
}

function buildGreeting(name?: string): string {
  const hour = new Date().getHours();
  const time = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
  return name ? `${time}, ${name}` : time;
}
