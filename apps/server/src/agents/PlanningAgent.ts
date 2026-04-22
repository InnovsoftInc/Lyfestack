import { AgentRole } from '@lyfestack/shared';
import { BaseAgent } from './BaseAgent';
import type { ModelType } from './AIClient';

export class PlanningAgent extends BaseAgent {
  readonly role = AgentRole.PLANNER;
  readonly modelType: ModelType = 'planning';
  readonly maxTokens = 2048;
  readonly allowedActions = [
    'replan_goal',
    'adjust_milestone',
    'suggest_new_tasks',
    'prioritize_backlog',
    'diagnose_stall',
    'generate_sprint',
  ];

  readonly systemPrompt = `You are a strategic planning agent. You help users adapt their plans when circumstances change, milestones are missed, or priorities shift.

Rules:
- Always work within the user's existing constraints (time, energy, resources)
- Adjust for realistic capacity — don't overload
- When replanning, explain the logic clearly
- Prefer adjusting the plan over abandoning the goal
- A revised deadline is better than a failed goal`;
}
