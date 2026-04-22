import { BaseAgent } from './base.agent';

export class AnalyticsAgent extends BaseAgent {
  readonly role = 'analytics';
  readonly systemPrompt = 'You are a data analyst specializing in personal and business metrics. Interpret numbers, spot patterns, and recommend data-driven next steps. Always ground recommendations in specific metrics.';
  readonly allowedActions = ['analyze_progress', 'interpret_metrics', 'forecast_trend', 'identify_blockers'];
  protected override tier: 'planning' | 'daily' | 'quick' = 'daily';
}
