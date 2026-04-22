import type { BaseAgent, AgentRequest, AgentResponse } from './BaseAgent';
import { ContentAgent } from './ContentAgent';
import { ResearchAgent } from './ResearchAgent';
import { CoachingAgent } from './CoachingAgent';
import { AnalyticsAgent } from './AnalyticsAgent';
import { PlanningAgent } from './PlanningAgent';

const ACTION_AGENT_MAP: Record<string, BaseAgent> = {};

function registerAgent(agent: BaseAgent) {
  for (const action of agent.allowedActions) {
    ACTION_AGENT_MAP[action] = agent;
  }
}

const contentAgent = new ContentAgent();
const researchAgent = new ResearchAgent();
const coachingAgent = new CoachingAgent();
const analyticsAgent = new AnalyticsAgent();
const planningAgent = new PlanningAgent();

registerAgent(contentAgent);
registerAgent(researchAgent);
registerAgent(coachingAgent);
registerAgent(analyticsAgent);
registerAgent(planningAgent);

export class AgentOrchestrator {
  dispatch(request: AgentRequest): Promise<AgentResponse> {
    const agent = ACTION_AGENT_MAP[request.taskType];
    if (!agent) {
      throw new Error(`No agent registered for action: ${request.taskType}`);
    }
    return agent.execute(request);
  }

  getAllowedActions(): Array<{ action: string; agentRole: string }> {
    return Object.entries(ACTION_AGENT_MAP).map(([action, agent]) => ({
      action,
      agentRole: agent.role,
    }));
  }
}

export const agentOrchestrator = new AgentOrchestrator();
