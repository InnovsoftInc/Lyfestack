import { z } from 'zod';
import { generateDailyBrief, DailyBriefResult } from '../engine/DailyLoopEngine';
import { ValidationError } from '../errors/AppError';

const GeneratePlanSchema = z.object({
  goalId: z.string().uuid(),
  userId: z.string().uuid(),
  title: z.string(),
  description: z.string(),
  goalIds: z.array(z.string()),
  goal: z.object({
    id: z.string(),
    userId: z.string(),
    templateId: z.string(),
    title: z.string(),
    description: z.string(),
    status: z.string(),
    targetDate: z.string(),
    progressScore: z.number(),
    createdAt: z.string(),
  }),
  status: z.literal('active'),
  startDate: z.string(),
  endDate: z.string(),
  milestones: z.array(z.any()),
  weeklyTaskBlueprint: z.array(z.any()),
  totalScheduledTasks: z.number(),
  createdAt: z.string(),
});

export const DailyBriefRequestSchema = z.object({
  userId: z.string().uuid(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'date must be YYYY-MM-DD'),
  plan: GeneratePlanSchema,
  currentStreak: z.number().int().min(0).optional(),
  currentScore: z.number().min(0).max(100).optional(),
});

export type DailyBriefRequest = z.infer<typeof DailyBriefRequestSchema>;

export class DailyLoopService {
  generateBrief(rawInput: unknown): DailyBriefResult {
    const parsed = DailyBriefRequestSchema.safeParse(rawInput);
    if (!parsed.success) {
      const msg = parsed.error.issues.map((i) => i.message).join('; ');
      throw new ValidationError(msg);
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return generateDailyBrief(parsed.data as any);
  }
}

export const dailyLoopService = new DailyLoopService();
