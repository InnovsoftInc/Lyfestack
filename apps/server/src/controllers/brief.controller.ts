import type { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { ValidationError } from '../errors/AppError';
import { generateDailyBrief } from '../services/brief.service';
import type { Task } from '@lyfestack/shared';

const generateBriefSchema = z.object({
  userId: z.string().min(1),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'date must be YYYY-MM-DD'),
  tasks: z.array(z.record(z.unknown())).optional(),
  goals: z
    .array(z.object({ title: z.string(), progressScore: z.number() }))
    .optional(),
  userName: z.string().optional(),
});

export async function generateBrief(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const parsed = generateBriefSchema.safeParse(req.body);
    if (!parsed.success) throw new ValidationError(parsed.error.message);

    const { tasks = [], ...rest } = parsed.data;
    const brief = await generateDailyBrief({
      ...rest,
      tasks: tasks as unknown as Task[],
    });
    res.json({ data: brief });
  } catch (err) {
    next(err);
  }
}
