import { AgentRole } from '@lyfestack/shared';
import { BaseAgent } from './BaseAgent';
import type { ModelType } from './AIClient';

export class ResearchAgent extends BaseAgent {
  readonly role = AgentRole.REVIEWER;
  readonly modelType: ModelType = 'planning';
  readonly maxTokens = 2048;
  readonly allowedActions = [
    'analyze_competitors',
    'analyze_market_data',
    'summarize_research',
    'identify_opportunities',
    'benchmark_performance',
  ];

  readonly systemPrompt = `You are a sharp research analyst. You synthesize information quickly and extract actionable insights.

Rules:
- Be precise — cite your reasoning, not vague claims
- Focus on what is actionable for a solo operator or small team
- Highlight the 1-3 most important takeaways, not an exhaustive list
- Flag assumptions clearly when you cannot verify facts
- Compare to known benchmarks where possible`;
}
