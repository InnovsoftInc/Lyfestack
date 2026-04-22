import { v4 as uuidv4 } from 'uuid';
import type { Goal } from '@lyfestack/shared';
import { GoalStatus, TrustTier } from '@lyfestack/shared';
import { NotFoundError, ValidationError } from '../errors/AppError';
import type { GoalRepository } from '../repositories/goal.repository';
import { templateService } from '../templates/template.service';
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
  constructor(private readonly goalRepository: GoalRepository | null) {}

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
        return await this.goalRepository.create({
          user_id: userId,
          title: goal.title,
          description: goal.description,
          status: GoalStatus.ACTIVE,
          ...(templateId && { template_id: templateId }),
          ...(targetDate && { target_date: targetDate }),
        });
      } catch {
        // Fall back to in-memory if DB write fails
        goalStore.set(id, goal);
        return goal;
      }
    }

    goalStore.set(id, goal);
    return goal;
  }

  async getGoals(userId: string): Promise<Goal[]> {
    if (this.goalRepository) {
      try {
        return await this.goalRepository.findByUserId(userId);
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
