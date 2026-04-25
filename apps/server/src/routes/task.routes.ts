import { Router } from 'express';
import type { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { ApprovalState, TaskStatus, TaskType } from '@lyfestack/shared';
import { getSupabaseClient } from '../config/database';
import { TaskRepository, type CreateTaskData } from '../repositories/task.repository';
import { NotFoundError, ValidationError } from '../errors/AppError';

const statusAliases: Record<string, TaskStatus> = {
  todo: TaskStatus.PENDING,
  pending: TaskStatus.PENDING,
  approved: TaskStatus.APPROVED,
  in_progress: TaskStatus.IN_PROGRESS,
  completed: TaskStatus.COMPLETED,
  done: TaskStatus.COMPLETED,
  review: TaskStatus.PENDING_APPROVAL,
  pending_approval: TaskStatus.PENDING_APPROVAL,
  skipped: TaskStatus.SKIPPED,
  failed: TaskStatus.FAILED,
};

const updateTaskSchema = z.object({
  title: z.string().min(1).optional(),
  description: z.string().nullable().optional(),
  type: z.nativeEnum(TaskType).optional(),
  status: z.string().optional(),
  approvalState: z.nativeEnum(ApprovalState).optional(),
  approval_state: z.nativeEnum(ApprovalState).optional(),
  scheduledFor: z.string().datetime().nullable().optional(),
  scheduled_for: z.string().datetime().nullable().optional(),
  durationMinutes: z.number().int().positive().nullable().optional(),
  duration_minutes: z.number().int().positive().nullable().optional(),
  confidenceScore: z.number().min(0).max(1).nullable().optional(),
  confidence_score: z.number().min(0).max(1).nullable().optional(),
});

type TaskPatch = Partial<CreateTaskData> & { completed_at?: string };

function normalizeStatus(value: unknown): TaskStatus | undefined {
  if (typeof value !== 'string' || value.length === 0) return undefined;
  const normalized = statusAliases[value.toLowerCase()] ?? value.toUpperCase();
  if (!Object.values(TaskStatus).includes(normalized as TaskStatus)) {
    throw new ValidationError(`Unsupported task status: ${value}`);
  }
  return normalized as TaskStatus;
}

function getRepository(): TaskRepository {
  return new TaskRepository(getSupabaseClient());
}

function filterByDate<T extends { scheduledFor?: string }>(tasks: T[], date?: unknown): T[] {
  if (typeof date !== 'string' || date.length === 0) return tasks;
  return tasks.filter((task) => task.scheduledFor?.startsWith(`${date}T`));
}

export function createTaskRouter(): Router {
  const router = Router();

  const listTasks = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const repo = getRepository();
      const status = normalizeStatus(req.query.status);
      const limit = Math.min(Math.max(Number(req.query.limit) || 100, 1), 500);

      let tasks = await repo.findByUserId(req.user!.id);
      if (status) tasks = tasks.filter((task) => task.status === status);
      tasks = filterByDate(tasks, req.query.date).slice(0, limit);

      res.json({ data: tasks, tasks });
    } catch (err) {
      next(err);
    }
  };

  router.get('/', listTasks);
  router.get('/list', listTasks);

  router.get('/:id', async (req, res, next) => {
    try {
      const task = await getRepository().findById(req.params.id);
      if (!task || task.userId !== req.user!.id) return next(new NotFoundError('Task'));
      res.json({ data: task, task });
    } catch (err) {
      next(err);
    }
  });

  router.patch('/:id', async (req, res, next) => {
    const parsed = updateTaskSchema.safeParse(req.body);
    if (!parsed.success) {
      return next(new ValidationError(parsed.error.issues[0]?.message ?? 'Invalid task update'));
    }

    try {
      const repo = getRepository();
      const existing = await repo.findById(req.params.id);
      if (!existing || existing.userId !== req.user!.id) return next(new NotFoundError('Task'));

      const input = parsed.data;
      const patch: TaskPatch = {};
      if (input.title !== undefined) patch.title = input.title;
      if (input.description !== undefined) patch.description = input.description;
      if (input.type !== undefined) patch.type = input.type;
      if (input.status !== undefined) patch.status = normalizeStatus(input.status);
      if (input.approvalState !== undefined) patch.approval_state = input.approvalState;
      if (input.approval_state !== undefined) patch.approval_state = input.approval_state;
      if (input.scheduledFor !== undefined) patch.scheduled_for = input.scheduledFor;
      if (input.scheduled_for !== undefined) patch.scheduled_for = input.scheduled_for;
      if (input.durationMinutes !== undefined) patch.duration_minutes = input.durationMinutes;
      if (input.duration_minutes !== undefined) patch.duration_minutes = input.duration_minutes;
      if (input.confidenceScore !== undefined) patch.confidence_score = input.confidenceScore;
      if (input.confidence_score !== undefined) patch.confidence_score = input.confidence_score;
      if (patch.status === TaskStatus.COMPLETED) patch.completed_at = new Date().toISOString();

      const task = await repo.update(req.params.id, patch);
      res.json({ data: task, task });
    } catch (err) {
      next(err);
    }
  });

  router.post('/:id/complete', async (req, res, next) => {
    try {
      const repo = getRepository();
      const existing = await repo.findById(req.params.id);
      if (!existing || existing.userId !== req.user!.id) return next(new NotFoundError('Task'));
      const task = await repo.update(req.params.id, {
        status: TaskStatus.COMPLETED,
        completed_at: new Date().toISOString(),
      } as TaskPatch);
      res.json({ data: task, task });
    } catch (err) {
      next(err);
    }
  });

  router.post('/:id/log', async (req, res, next) => {
    try {
      const task = await getRepository().findById(req.params.id);
      if (!task || task.userId !== req.user!.id) return next(new NotFoundError('Task'));
      res.status(202).json({ data: { ok: true } });
    } catch (err) {
      next(err);
    }
  });

  return router;
}
