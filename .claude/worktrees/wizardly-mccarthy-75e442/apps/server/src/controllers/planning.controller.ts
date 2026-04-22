import type { Request, Response } from 'express';
import { z } from 'zod';
import { planningService } from '../services/planning.service';

const generatePlanSchema = z.object({
  userId: z.string().min(1),
  templateId: z.string().min(1),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'startDate must be YYYY-MM-DD'),
  diagnosticAnswers: z.record(z.string(), z.union([z.string(), z.number()])).default({}),
});

export function generatePlan(req: Request, res: Response): void {
  const input = generatePlanSchema.parse(req.body);
  const plan = planningService.generatePlan(input);
  res.status(201).json({ data: plan });
}
