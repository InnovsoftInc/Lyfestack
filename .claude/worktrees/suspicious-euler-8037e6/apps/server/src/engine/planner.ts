import { chatCompletion } from '../integrations/openrouter/openrouter.client';
import { TemplateRegistry } from '../templates/registry';
import { NotFoundError } from '../errors/AppError';
import { logger } from '../utils/logger';

export interface PlanContext {
  templateId: string;
  goalTitle: string;
  userNotes?: string | undefined;
  startDate: string;
  targetDate?: string | undefined;
}

export interface GeneratedTask {
  title: string;
  description: string;
  type: string;
  scheduledFor: string;
  durationMinutes: number;
}

export interface GeneratedPlan {
  templateId: string;
  goalTitle: string;
  startDate: string;
  targetDate: string;
  summary: string;
  weeklyTheme: string[];
  tasks: GeneratedTask[];
}

interface PlannerLLMResponse {
  summary: string;
  weeklyTheme: string[];
  tasks: GeneratedTask[];
}

export async function generatePlan(context: PlanContext): Promise<GeneratedPlan> {
  const template = TemplateRegistry.getById(context.templateId);
  if (!template) throw new NotFoundError(`Template ${context.templateId}`);

  const startDate = new Date(context.startDate);
  const endDate = context.targetDate
    ? new Date(context.targetDate)
    : new Date(startDate.getTime() + template.durationDays * 86_400_000);

  const endDateStr = endDate.toISOString().split('T')[0] ?? context.startDate;

  const systemPrompt = `${template.prompt}

You are generating a structured plan for the Lyfestack app. Always respond with valid JSON matching the schema below. No other text.

Schema:
{
  "summary": "string — 2-3 sentence personalized plan overview",
  "weeklyTheme": ["string — theme for each week, e.g. 'Foundation Building'"],
  "tasks": [
    {
      "title": "string",
      "description": "string",
      "type": "ACTION|HABIT|MILESTONE|REFLECTION|SOCIAL",
      "scheduledFor": "ISO date string",
      "durationMinutes": number
    }
  ]
}

Generate tasks for the first 7 days only. Mix task types based on: ${template.defaultTaskTypes.join(', ')}. Target 2-4 tasks per day.`;

  const userMessage = `Create a personalized plan:
Goal: ${context.goalTitle}
Template: ${template.name}
Start: ${context.startDate}
Target: ${endDateStr}
Duration: ${template.durationDays} days${context.userNotes ? `\nNotes: ${context.userNotes}` : ''}

Milestones:
${template.milestones.map((m, i) => `${i + 1}. ${m}`).join('\n')}`;

  logger.info({ templateId: context.templateId }, 'Generating plan via LLM');

  const raw = await chatCompletion(
    [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userMessage },
    ],
    { temperature: 0.6, maxTokens: 3000 },
  );

  const parsed = parseJSON<PlannerLLMResponse>(raw);

  return {
    templateId: context.templateId,
    goalTitle: context.goalTitle,
    startDate: context.startDate,
    targetDate: endDateStr,
    summary: parsed.summary,
    weeklyTheme: parsed.weeklyTheme,
    tasks: parsed.tasks,
  };
}

function parseJSON<T>(raw: string): T {
  try {
    return JSON.parse(raw) as T;
  } catch {
    const match = raw.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (match?.[1]) return JSON.parse(match[1]) as T;
    throw new Error(`Failed to parse planner response: ${raw.slice(0, 200)}`);
  }
}
