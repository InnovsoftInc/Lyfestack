import { ValidationError } from '../errors/AppError';
import { goalTemplateService } from './goal-template.service';
import { planningEngine } from '../engine/planning/PlanningEngine';
import type { DiagnosticAnswers, GeneratedPlan, UserContext } from '../engine/planning/types';
import { supabase } from '../lib/supabase';

export class PlanningService {
  async generatePlan(
    goalId: string,
    templateId: string,
    answers: DiagnosticAnswers,
    context: UserContext,
  ): Promise<GeneratedPlan> {
    const template = goalTemplateService.getById(templateId);

    const missing = template.diagnosticQuestions.filter((q) => answers[q.id] === undefined);
    if (missing.length > 0) {
      throw new ValidationError(`Missing answers for: ${missing.map((q) => q.id).join(', ')}`);
    }

    const plan = planningEngine.generate(template, answers, context);

    await supabase.from('plans').upsert({
      goal_id: goalId,
      user_id: context.userId,
      template_id: templateId,
      data: plan,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });

    return plan;
  }

  async getPlanForGoal(goalId: string): Promise<GeneratedPlan | null> {
    const { data } = await supabase.from('plans').select('data').eq('goal_id', goalId).single();
    return data ? (data['data'] as GeneratedPlan) : null;
  }
}

export const planningService = new PlanningService();
