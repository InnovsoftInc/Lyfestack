import { BaseAgent } from './base.agent';

export class PlanningAgent extends BaseAgent {
  readonly role = 'planning';
  readonly systemPrompt = 'You are a strategic planning expert. Help users break down goals into actionable steps, adjust plans when circumstances change, and prioritize what matters most. Be structured and specific.';
  readonly allowedActions = ['adjust_plan', 'reprioritize', 'break_down_task', 'suggest_milestone'];
  protected override tier: 'planning' | 'daily' | 'quick' = 'planning';
  protected override maxTokens = 2048;
}
