import type { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { ValidationError } from '../errors/AppError';
import { scoreGoal } from '../engine/scoring';
import type { Task } from '@lyfestack/shared';

const scoreSchema = z.object({
  tasks: z.array(z.record(z.unknown())),
});

export function computeScore(req: Request, res: Response, next: NextFunction): void {
  try {
    const parsed = scoreSchema.safeParse(req.body);
    if (!parsed.success) throw new ValidationError(parsed.error.message);

    const result = scoreGoal(parsed.data.tasks as unknown as Task[]);
    res.json({ data: result });
  } catch (err) {
    next(err);
  }
}
