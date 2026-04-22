import { v4 as uuidv4 } from 'uuid';
import type { Plan } from '@lyfestack/shared';
import { GoalStatus } from '@lyfestack/shared';
import { ValidationError, NotFoundError } from '../../errors/AppError';
import { templateService } from '../../templates/template.service';
import type { DiagnosticAnswer } from '../../templates/template.types';
import { planningEngine } from './planning.engine';
import type { UserContext } from './planning.types';

// In-memory store — replaced by DB repository in a later milestone
const planStore = new Map<string, Plan>();

export class PlanningService {
  async createPlan(
    goalId: string,
    templateId: string,
    answers: DiagnosticAnswer[],
    context: UserContext,
  ): Promise<Plan> {
    if (planStore.has(goalId)) {
      throw new ValidationError(`Plan already exists for goal ${goalId}`, 'PLAN_EXISTS');
    }

    const template = await templateService.getById(templateId);
    const draft = planningEngine.generatePlan(template, answers, context);

    const now = new Date().toISOString();
    const startDate = now.slice(0, 10);
    const endDate = new Date(Date.now() + draft.estimatedDurationDays * 86_400_000)
      .toISOString()
      .slice(0, 10);

    const plan: Plan = {
      id: uuidv4(),
      userId: context.userId,
      title: draft.title,
      description: draft.description,
      goalIds: [goalId],
      status: GoalStatus.ACTIVE,
      startDate,
      endDate,
      createdAt: now,
      updatedAt: now,
    };

    planStore.set(goalId, plan);
    return plan;
  }

  getPlanForGoal(goalId: string): Plan {
    const plan = planStore.get(goalId);
    if (!plan) throw new NotFoundError(`Plan for goal ${goalId}`);
    return plan;
  }
}

export const planningService = new PlanningService();
