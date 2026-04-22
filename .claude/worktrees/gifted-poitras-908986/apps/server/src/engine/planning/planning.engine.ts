import type { DiagnosticAnswer, TemplateDefinition } from '../../templates/template.types';
import { TemplateCategory } from '../../templates/template.types';
import type { IPlanningStrategy } from './planning.strategy';
import { CareerStrategy } from './strategies/career.strategy';
import { DefaultStrategy } from './strategies/default.strategy';
import { FinanceStrategy } from './strategies/finance.strategy';
import { FitnessStrategy } from './strategies/fitness.strategy';
import type { PlanDraft, UserContext } from './planning.types';

export class PlanningEngine {
  private readonly strategies: Map<TemplateCategory, IPlanningStrategy>;
  private readonly defaultStrategy: IPlanningStrategy;

  constructor() {
    this.defaultStrategy = new DefaultStrategy();
    this.strategies = new Map([
      [TemplateCategory.FITNESS, new FitnessStrategy()],
      [TemplateCategory.FINANCE, new FinanceStrategy()],
      [TemplateCategory.CAREER, new CareerStrategy()],
    ]);
  }

  generatePlan(
    template: TemplateDefinition,
    answers: DiagnosticAnswer[],
    context: UserContext,
  ): PlanDraft {
    const strategy = this.strategies.get(template.category) ?? this.defaultStrategy;
    return strategy.generate(template, answers, context);
  }
}

export const planningEngine = new PlanningEngine();
