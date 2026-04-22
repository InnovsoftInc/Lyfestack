import type { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { ValidationError } from '../errors/AppError';
import type { GoalService } from '../services/goal.service';

const createGoalSchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().max(1000).default(''),
  templateId: z.string().optional(),
  diagnosticAnswers: z
    .array(
      z.object({
        questionId: z.string(),
        value: z.union([z.string(), z.number(), z.boolean()]),
      }),
    )
    .optional(),
  targetDate: z.string().optional(),
});

const generatePlanSchema = z.object({
  templateId: z.string(),
  answers: z.array(
    z.object({
      questionId: z.string(),
      value: z.union([z.string(), z.number(), z.boolean()]),
    }),
  ),
});

export class GoalController {
  constructor(private readonly goalService: GoalService) {}

  createGoal = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const parsed = createGoalSchema.safeParse(req.body);
    if (!parsed.success) {
      return next(new ValidationError(parsed.error.issues[0]?.message ?? 'Invalid input'));
    }

    if (!req.user) {
      return next(new ValidationError('Authentication required'));
    }

    try {
      const { title, description, templateId, diagnosticAnswers, targetDate } = parsed.data;
      const goal = await this.goalService.createGoal({
        userId: req.user.id,
        title,
        description,
        ...(templateId !== undefined && { templateId }),
        ...(diagnosticAnswers !== undefined && { diagnosticAnswers }),
        ...(targetDate !== undefined && { targetDate }),
      });
      res.status(201).json({ goal });
    } catch (err) {
      next(err);
    }
  };

  getGoals = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    if (!req.user) {
      return next(new ValidationError('Authentication required'));
    }

    try {
      const goals = await this.goalService.getGoals(req.user.id);
      res.json({ goals });
    } catch (err) {
      next(err);
    }
  };

  getGoal = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    if (!req.user) {
      return next(new ValidationError('Authentication required'));
    }

    const { id } = req.params;
    if (!id) {
      return next(new ValidationError('Goal ID required'));
    }

    try {
      const goal = await this.goalService.getGoal(id, req.user.id);
      res.json({ goal });
    } catch (err) {
      next(err);
    }
  };

  generatePlan = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    if (!req.user) {
      return next(new ValidationError('Authentication required'));
    }

    const { id } = req.params;
    if (!id) {
      return next(new ValidationError('Goal ID required'));
    }

    const parsed = generatePlanSchema.safeParse(req.body);
    if (!parsed.success) {
      return next(new ValidationError(parsed.error.issues[0]?.message ?? 'Invalid input'));
    }

    try {
      const plan = await this.goalService.generatePlan(
        id,
        parsed.data.templateId,
        parsed.data.answers,
        req.user.id,
      );
      res.status(201).json({ plan });
    } catch (err) {
      next(err);
    }
  };
}
