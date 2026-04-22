import { AgentRole } from '@lyfestack/shared';
import { BaseAgent } from './base.agent';

export class ContentAgent extends BaseAgent {
  readonly role = AgentRole.EXECUTOR;
  readonly systemPrompt =
    'You are a content creation specialist. You write motivating, clear, and actionable content for users pursuing personal goals. Your output is concise, encouraging, and formatted for daily consumption.';
  readonly allowedActions = [
    'draft_daily_brief',
    'write_task_description',
    'generate_milestone_celebration',
    'create_reflection_prompt',
  ];

  constructor() {
    super();
    this.completionOpts = { temperature: 0.8, maxTokens: 512 };
  }
}

export const contentAgent = new ContentAgent();
