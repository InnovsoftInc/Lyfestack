import { AIClient } from './ai-client';
import { BaseAgent, AgentResult } from './base.agent';
import { ContentAgent } from './content.agent';
import { ResearchAgent } from './research.agent';
import { CoachingAgent } from './coaching.agent';
import { AnalyticsAgent } from './analytics.agent';
import { PlanningAgent } from './planning.agent';
import { logger } from '../utils/logger';

export class AgentOrchestrator {
  private agents: Map<string, BaseAgent> = new Map();

  constructor(client: AIClient) {
    this.agents.set('content', new ContentAgent(client));
    this.agents.set('research', new ResearchAgent(client));
    this.agents.set('coaching', new CoachingAgent(client));
    this.agents.set('analytics', new AnalyticsAgent(client));
    this.agents.set('planning', new PlanningAgent(client));
  }

  async dispatch(agentRole: string, prompt: string, context?: Record<string, unknown>): Promise<AgentResult> {
    const agent = this.agents.get(agentRole);
    if (!agent) throw new Error(`Unknown agent role: ${agentRole}`);
    
    logger.info({ agent: agentRole, promptLength: prompt.length }, 'Dispatching agent');
    const result = await agent.execute(prompt, context);
    logger.info({ agent: agentRole, confidence: result.confidenceScore }, 'Agent completed');
    
    return result;
  }

  getAvailableAgents(): string[] {
    return Array.from(this.agents.keys());
  }

  getAgentActions(role: string): string[] {
    return this.agents.get(role)?.allowedActions ?? [];
  }
}
