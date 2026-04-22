import type { AgentRole } from '@lyfestack/shared';
import { ValidationError } from '../errors/AppError';
import type { BaseAgent, AgentInput, AgentOutput } from './base.agent';
import { analyticsAgent } from './analytics.agent';
import { coachingAgent } from './coaching.agent';
import { contentAgent } from './content.agent';
import { planningAgent } from './planning.agent';
import { researchAgent } from './research.agent';

const AGENT_REGISTRY = new Map<string, BaseAgent>([
  ['content', contentAgent],
  ['research', researchAgent],
  ['coaching', coachingAgent],
  ['analytics', analyticsAgent],
  ['planning', planningAgent],
]);

export interface OrchestratorRequest {
  agentKey: string;
  input: AgentInput;
  requestedActions?: string[];
}

export class AgentOrchestrator {
  private enforceActionConstraints(agent: BaseAgent, requestedActions: string[]): void {
    const disallowed = requestedActions.filter((a) => !agent.allowedActions.includes(a));
    if (disallowed.length > 0) {
      throw new ValidationError(
        `Agent ${agent.role} does not support actions: ${disallowed.join(', ')}`,
        'AGENT_ACTION_NOT_ALLOWED',
      );
    }
  }

  async dispatch(request: OrchestratorRequest): Promise<AgentOutput> {
    const agent = AGENT_REGISTRY.get(request.agentKey);
    if (!agent) {
      throw new ValidationError(
        `Unknown agent: ${request.agentKey}. Available: ${[...AGENT_REGISTRY.keys()].join(', ')}`,
        'UNKNOWN_AGENT',
      );
    }

    if (request.requestedActions && request.requestedActions.length > 0) {
      this.enforceActionConstraints(agent, request.requestedActions);
    }

    return agent.execute(request.input);
  }

  getAvailableAgents(): { key: string; role: AgentRole; allowedActions: string[] }[] {
    return [...AGENT_REGISTRY.entries()].map(([key, agent]) => ({
      key,
      role: agent.role,
      allowedActions: agent.allowedActions,
    }));
  }
}

export const agentOrchestrator = new AgentOrchestrator();
