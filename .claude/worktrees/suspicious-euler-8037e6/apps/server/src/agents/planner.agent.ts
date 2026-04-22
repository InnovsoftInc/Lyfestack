import { AgentRole } from '@lyfestack/shared';
import { BaseAgent } from './base.agent';
import { generatePlan } from '../engine/planner';
import type { PlanContext, GeneratedPlan } from '../engine/planner';

export class PlannerAgent extends BaseAgent {
  readonly role = AgentRole.PLANNER;
  readonly systemPrompt = `You are the Lyfestack Planner Agent. Your job is to create personalized, achievable goal plans that set users up for success. You break big goals into concrete daily and weekly tasks, calibrated to the user's schedule and energy level. You always favor momentum over perfection — small consistent actions beat sporadic heroic efforts.`;

  async plan(context: PlanContext): Promise<GeneratedPlan> {
    return generatePlan(context);
  }
}

export const plannerAgent = new PlannerAgent();
