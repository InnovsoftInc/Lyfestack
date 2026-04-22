import { AgentRole } from '@lyfestack/shared';
import { BaseAgent } from './base.agent';

export class AnalyticsAgent extends BaseAgent {
  readonly role = AgentRole.REVIEWER;
  readonly systemPrompt =
    'You are a data and analytics specialist. You analyze user behavior, task completion patterns, and goal progress to surface actionable insights. You are precise, data-driven, and translate patterns into clear recommendations.';
  readonly allowedActions = [
    'analyze_completion_rate',
    'identify_streak_patterns',
    'surface_bottlenecks',
    'generate_progress_report',
    'recommend_schedule_adjustment',
  ];

  constructor() {
    super();
    this.completionOpts = { temperature: 0.2, maxTokens: 1024 };
  }
}

export const analyticsAgent = new AnalyticsAgent();
