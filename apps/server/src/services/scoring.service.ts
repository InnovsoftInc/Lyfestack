import { z } from 'zod';
import { calculateScore, ScoreResult } from '../engine/ScoringEngine';
import { ValidationError } from '../errors/AppError';

export const ScoreRequestSchema = z.object({
  goalId: z.string().uuid(),
  templateId: z.string().min(1),
  totalMilestones: z.number().int().min(0),
  completedMilestones: z.number().int().min(0),
  totalTasksScheduled: z.number().int().min(0),
  completedTasks: z.number().int().min(0),
  currentStreak: z.number().int().min(0),
  daysElapsed: z.number().int().min(0),
  leadingIndicatorScores: z.record(z.number().min(0).max(100)).optional(),
});

export type ScoreRequest = z.infer<typeof ScoreRequestSchema>;

export class ScoringService {
  calculateScore(rawInput: unknown): ScoreResult {
    const parsed = ScoreRequestSchema.safeParse(rawInput);
    if (!parsed.success) {
      const msg = parsed.error.issues.map((i) => i.message).join('; ');
      throw new ValidationError(msg);
    }
    return calculateScore(parsed.data);
  }
}

export const scoringService = new ScoringService();
