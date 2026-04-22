import type { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { ValidationError } from '../errors/AppError';
import { generatePlan } from '../engine/planner';

const generatePlanSchema = z.object({
  templateId: z.string().min(1),
  goalTitle: z.string().min(1),
  userNotes: z.string().optional(),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'startDate must be YYYY-MM-DD'),
  targetDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'targetDate must be YYYY-MM-DD')
    .optional(),
});

export async function createPlan(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const parsed = generatePlanSchema.safeParse(req.body);
    if (!parsed.success) throw new ValidationError(parsed.error.message);

    const plan = await generatePlan(parsed.data);
    res.status(201).json({ data: plan });
  } catch (err) {
    next(err);
  }
}
