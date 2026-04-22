import { BaseAgent } from './base.agent';

export class ResearchAgent extends BaseAgent {
  readonly role = 'research';
  readonly systemPrompt = 'You are a research analyst. Analyze data, identify trends, and provide actionable insights. Be specific with numbers and recommendations. Always cite your reasoning.';
  readonly allowedActions = ['analyze_metrics', 'research_competitors', 'research_trends', 'market_analysis'];
  protected override tier: 'planning' | 'daily' | 'quick' = 'planning';
  protected override maxTokens = 2048;
}
