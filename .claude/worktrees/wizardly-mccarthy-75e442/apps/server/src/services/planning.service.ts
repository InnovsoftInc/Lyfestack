import { generatePlan } from '../engine/planningEngine';
import type { PlanGenerationInput, GeneratedPlan } from '../engine/planningEngine';

export class PlanningService {
  generatePlan(input: PlanGenerationInput): GeneratedPlan {
    return generatePlan(input);
  }
}

export const planningService = new PlanningService();
