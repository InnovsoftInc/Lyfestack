import { v4 as uuidv4 } from 'uuid';
import type { Goal } from '@lyfestack/shared';
import { GoalStatus, TaskStatus, ApprovalState, TrustTier } from '@lyfestack/shared';
import { NotFoundError, ValidationError } from '../errors/AppError';
import { logger } from '../utils/logger';
import type { GoalRepository } from '../repositories/goal.repository';
import type { TaskRepository } from '../repositories/task.repository';
import { templateService } from '../templates/template.service';
import { planningEngine } from '../engine/planning/planning.engine';
import { planningService } from '../engine/planning/planning.service';
import type { DiagnosticAnswer } from '../templates/template.types';

export interface CreateGoalInput {
  userId: string;
  title: string;
  description: string;
  templateId?: string;
  diagnosticAnswers?: DiagnosticAnswer[];
  targetDate?: string;
}

// In-memory goal store — used when DB (Supabase) is not configured
const goalStore = new Map<string, Goal>();

export class GoalService {
  constructor(
    private readonly goalRepository: GoalRepository | null,
    private readonly taskRepository: TaskRepository | null = null,
  ) {}

  async createGoal(input: CreateGoalInput): Promise<Goal> {
    const { userId, title, description, templateId, diagnosticAnswers, targetDate } = input;

    if (!title?.trim()) throw new ValidationError('Goal title is required', 'MISSING_TITLE');

    const now = new Date().toISOString();
    const id = uuidv4();

    const goal: Goal = {
      id,
      userId,
      title: title.trim(),
      description: description?.trim() ?? '',
      status: GoalStatus.ACTIVE,
      progressScore: 0,
      milestones: [],
      createdAt: now,
      updatedAt: now,
      ...(templateId && { templateId }),
      ...(targetDate && { targetDate }),
      ...(diagnosticAnswers && {
        diagnosticAnswers: Object.fromEntries(
          diagnosticAnswers.map((a) => [a.questionId, a.value]),
        ),
      }),
    };

    if (this.goalRepository) {
      try {
        const saved = await this.goalRepository.create({
          user_id: userId,
          title: goal.title,
          description: goal.description,
          status: GoalStatus.ACTIVE,
          ...(templateId && { template_id: templateId }),
          ...(targetDate && { target_date: targetDate }),
        });
        await this._generateTasks(saved.id, userId, templateId, diagnosticAnswers ?? []);
        return saved;
      } catch (err) {
        logger.warn({ err }, '[GoalService] DB save failed, falling back to in-memory');
        goalStore.set(id, goal);
        return goal;
      }
    }

    goalStore.set(id, goal);
    return goal;
  }

  private async _generateTasks(
    goalId: string,
    userId: string,
    templateId: string | undefined,
    answers: DiagnosticAnswer[],
  ): Promise<void> {
    if (!templateId || !this.taskRepository) return;
    const template = templateService.getById(templateId);
    if (!template) return;

    const plan = planningEngine.generatePlan(template, answers, {
      userId,
      trustTier: TrustTier.AUTONOMOUS,
      engagementVelocity: 0.7,
      currentTaskLoad: 0,
    });

    const now = new Date();
    await Promise.all(
      plan.tasks.map((t) => {
        const scheduledDate = new Date(now);
        scheduledDate.setDate(scheduledDate.getDate() + t.dayOffset);
        return this.taskRepository!.create({
          goal_id: goalId,
          user_id: userId,
          title: t.title,
          description: t.description,
          type: t.type,
          status: TaskStatus.PENDING,
          approval_state: ApprovalState.PENDING,
          scheduled_for: scheduledDate.toISOString(),
          duration_minutes: t.durationMinutes,
        });
      }),
    );
  }

  async getGoals(userId: string): Promise<Goal[]> {
    if (this.goalRepository) {
      try {
        const dbGoals = await this.goalRepository.findByUserId(userId);
        const memGoals = Array.from(goalStore.values()).filter((g) => g.userId === userId);
        if (dbGoals.length > 0 || memGoals.length === 0) return dbGoals;
        // DB returned empty but we have in-memory goals (DB write failed earlier)
        return memGoals;
      } catch {
        // fall through to in-memory
      }
    }
    return Array.from(goalStore.values()).filter((g) => g.userId === userId);
  }

  async getGoal(id: string, userId: string): Promise<Goal> {
    if (this.goalRepository) {
      try {
        const goal = await this.goalRepository.findById(id);
        if (goal && goal.userId === userId) return goal;
      } catch {
        // fall through to in-memory
      }
    }
    const goal = goalStore.get(id);
    if (!goal || goal.userId !== userId) throw new NotFoundError(`Goal ${id}`);
    return goal;
  }

  async generatePlan(
    goalId: string,
    templateId: string,
    answers: DiagnosticAnswer[],
    userId: string,
  ) {
    const template = templateService.getById(templateId);
    if (!template) throw new NotFoundError(`Template ${templateId}`);

    return planningService.createPlan(goalId, templateId, answers, {
      userId,
      trustTier: TrustTier.AUTONOMOUS,
      engagementVelocity: 0.5,
      currentTaskLoad: 0,
    });
  }
}
