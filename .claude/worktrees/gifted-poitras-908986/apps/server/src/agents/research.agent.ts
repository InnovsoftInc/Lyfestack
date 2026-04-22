import { AgentRole } from '@lyfestack/shared';
import { BaseAgent } from './base.agent';

export class ResearchAgent extends BaseAgent {
  readonly role = AgentRole.EXECUTOR;
  readonly systemPrompt =
    'You are a research specialist. You gather, synthesize, and present relevant information to help users understand their goals, benchmarks, and best practices. You are factual, thorough, and cite reasoning clearly.';
  readonly allowedActions = [
    'research_goal_benchmarks',
    'find_best_practices',
    'summarize_domain_knowledge',
    'identify_common_obstacles',
  ];

  constructor() {
    super();
    this.completionOpts = { temperature: 0.3, maxTokens: 1024 };
  }
}

export const researchAgent = new ResearchAgent();
