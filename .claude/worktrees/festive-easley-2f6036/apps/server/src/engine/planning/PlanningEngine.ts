import type { FullGoalTemplate } from '../../templates/templates.data';
import type { DiagnosticAnswers, GeneratedPlan, UserContext } from './types';
import { ProductivityStrategy } from './strategies/productivity.strategy';
import { SelfImprovementStrategy } from './strategies/self-improvement.strategy';
import { SoloBusinessStrategy } from './strategies/solo-business.strategy';
import { SocialMediaStrategy } from './strategies/social-media.strategy';
import { FitnessStrategy } from './strategies/fitness.strategy';
import type { PlanningStrategy } from './types';

const STRATEGIES: Record<FullGoalTemplate['category'], PlanningStrategy> = {
  productivity: new ProductivityStrategy(),
  'self-improvement': new SelfImprovementStrategy(),
  'solo-business': new SoloBusinessStrategy(),
  'social-media': new SocialMediaStrategy(),
  fitness: new FitnessStrategy(),
};

export class PlanningEngine {
  generate(template: FullGoalTemplate, answers: DiagnosticAnswers, context: UserContext): GeneratedPlan {
    const strategy = STRATEGIES[template.category];
    return strategy.generate(template, answers, context);
  }
}

export const planningEngine = new PlanningEngine();
