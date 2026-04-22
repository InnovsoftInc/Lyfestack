import type { Request, Response } from 'express';
import { z } from 'zod';
import { scoringService } from '../services/scoring.service';

const indicatorScoreSchema = z.object({
  metric: z.string().min(1),
  value: z.number().min(0),
  target: z.number().min(0),
});

const calculateScoreSchema = z.object({
  completedTasks: z.number().int().min(0),
  expectedTasks: z.number().int().min(0),
  completedMilestones: z.number().int().min(0),
  totalMilestones: z.number().int().min(0),
  currentStreak: z.number().int().min(0).default(0),
  leadingIndicatorScores: z.array(indicatorScoreSchema).default([]),
});

export function calculateScore(req: Request, res: Response): void {
  const input = calculateScoreSchema.parse(req.body);
  const result = scoringService.calculate(input);
  res.status(200).json({ data: result });
}
