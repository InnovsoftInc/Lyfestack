import { AgentRole } from '@lyfestack/shared';
import { BaseAgent } from './base.agent';

export class PlanningAgent extends BaseAgent {
  readonly role = AgentRole.PLANNER;
  readonly systemPrompt =
    'You are a strategic planning specialist. You break down goals into actionable milestones and tasks, sequence work optimally, anticipate blockers, and adapt plans based on user progress and feedback. You think in systems and sequences.';
  readonly allowedActions = [
    'generate_goal_plan',
    'adjust_plan_timeline',
    'break_down_milestone',
    'reprioritize_tasks',
    'identify_dependencies',
    'suggest_quick_wins',
  ];

  constructor() {
    super();
    this.completionOpts = { temperature: 0.4, maxTokens: 1024 };
  }
}

export const planningAgent = new PlanningAgent();
