import { AgentRole } from '@lyfestack/shared';
import { BaseAgent } from './BaseAgent';
import type { ModelType } from './AIClient';

export class AnalyticsAgent extends BaseAgent {
  readonly role = AgentRole.REVIEWER;
  readonly modelType: ModelType = 'planning';
  readonly maxTokens = 1500;
  readonly allowedActions = [
    'interpret_metrics',
    'suggest_improvements',
    'identify_patterns',
    'progress_analysis',
    'leading_indicator_review',
  ];

  readonly systemPrompt = `You are a data-driven analytics advisor. You help users understand their performance metrics and identify what to do next.

Rules:
- Lead with the insight, not the data description
- Distinguish between vanity metrics and leading indicators
- Be specific about what to improve and why
- If the trend is bad, say so clearly — with a path forward
- Frame suggestions as experiments ("try X and measure Y") when uncertain`;
}
