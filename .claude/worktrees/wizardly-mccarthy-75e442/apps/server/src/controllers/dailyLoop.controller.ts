import type { Request, Response } from 'express';
import { z } from 'zod';
import { dailyLoopService } from '../services/dailyLoop.service';

const dailyTaskSchema = z.object({
  title: z.string().min(1),
  type: z.string().min(1),
  durationMinutes: z.number().int().min(1),
  priority: z.enum(['high', 'medium', 'low']),
});

const generateBriefSchema = z.object({
  userId: z.string().min(1),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'date must be YYYY-MM-DD'),
  templateId: z.string().min(1),
  currentStreak: z.number().int().min(0).default(0),
  recentScores: z.array(z.number().min(0).max(100)).max(30).default([]),
  pendingMilestoneCount: z.number().int().min(0).default(0),
  completedTasksToday: z.number().int().min(0).default(0),
  plannedTasksToday: z.array(dailyTaskSchema).default([]),
});

export function generateBrief(req: Request, res: Response): void {
  const input = generateBriefSchema.parse(req.body);
  const brief = dailyLoopService.generateBrief(input);
  res.status(200).json({ data: brief });
}
