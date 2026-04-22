import type { Request, Response } from 'express';
import { z } from 'zod';
import { agentService } from '../services/agent.service';
import { ValidationError } from '../errors/AppError';

const dailyTaskSchema = z.object({
  title: z.string().min(1),
  type: z.string().min(1),
  durationMinutes: z.number().int().min(1),
  priority: z.enum(['high', 'medium', 'low']),
});

const indicatorScoreSchema = z.object({
  metric: z.string().min(1),
  value: z.number().min(0),
  target: z.number().min(0),
});

const runAgentSchema = z.discriminatedUnion('role', [
  z.object({
    role: z.literal('PLANNER'),
    input: z.object({
      userId: z.string().min(1),
      templateId: z.string().min(1),
      startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      diagnosticAnswers: z.record(z.string(), z.union([z.string(), z.number()])).default({}),
      rationale: z.string().optional(),
    }),
  }),
  z.object({
    role: z.literal('COACH'),
    input: z.object({
      userId: z.string().min(1),
      date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      templateId: z.string().min(1),
      currentStreak: z.number().int().min(0).default(0),
      recentScores: z.array(z.number().min(0).max(100)).max(30).default([]),
      pendingMilestoneCount: z.number().int().min(0).default(0),
      completedTasksToday: z.number().int().min(0).default(0),
      plannedTasksToday: z.array(dailyTaskSchema).default([]),
      rationale: z.string().optional(),
    }),
  }),
  z.object({
    role: z.literal('REVIEWER'),
    input: z.object({
      userId: z.string().min(1),
      periodLabel: z.string().min(1),
      completedTasks: z.number().int().min(0),
      expectedTasks: z.number().int().min(0),
      completedMilestones: z.number().int().min(0),
      totalMilestones: z.number().int().min(0),
      currentStreak: z.number().int().min(0).default(0),
      leadingIndicatorScores: z.array(indicatorScoreSchema).default([]),
      rationale: z.string().optional(),
    }),
  }),
]);

export function runAgent(req: Request, res: Response): void {
  const parsed = runAgentSchema.parse(req.body);

  if (parsed.role === 'PLANNER') {
    const { rationale, ...rest } = parsed.input;
    const input = rationale !== undefined ? { ...rest, rationale } : rest;
    const result = agentService.run({ role: 'PLANNER', input });
    res.status(201).json({ data: result });
  } else if (parsed.role === 'COACH') {
    const { rationale, ...rest } = parsed.input;
    const input = rationale !== undefined ? { ...rest, rationale } : rest;
    const result = agentService.run({ role: 'COACH', input });
    res.status(200).json({ data: result });
  } else if (parsed.role === 'REVIEWER') {
    const { rationale, ...rest } = parsed.input;
    const input = rationale !== undefined ? { ...rest, rationale } : rest;
    const result = agentService.run({ role: 'REVIEWER', input });
    res.status(200).json({ data: result });
  } else {
    throw new ValidationError('Unknown agent role');
  }
}

export function listAgentActions(req: Request, res: Response): void {
  const userId = typeof req.query['userId'] === 'string' ? req.query['userId'] : undefined;
  const actions = agentService.listActions(userId);
  res.status(200).json({ data: actions, count: actions.length });
}
