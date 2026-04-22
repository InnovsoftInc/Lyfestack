import { GoalTemplate } from '@lyfestack/shared';
import { getStrategyForCategory, PlanOutput } from './planning.strategy';

export class PlanningEngine {
  generatePlan(template: GoalTemplate, diagnosticAnswers: Record<string, unknown>, startDate: Date = new Date()): PlanOutput {
    const strategy = getStrategyForCategory(template.category);
    return strategy.generatePlan(template, diagnosticAnswers, startDate);
  }
}
