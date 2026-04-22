import { AgentRole } from '@lyfestack/shared';
import { ContentAgent } from './content.agent';
import { ResearchAgent } from './research.agent';
import { CoachingAgent } from './coaching.agent';
import { AnalyticsAgent } from './analytics.agent';
import { PlanningAgent } from './planning.agent';

export type { AgentContext, AgentResponse, AgentMessage } from './base.agent';
export { BaseAgent } from './base.agent';
export { ContentAgent } from './content.agent';
export { ResearchAgent } from './research.agent';
export { CoachingAgent } from './coaching.agent';
export { AnalyticsAgent } from './analytics.agent';
export { PlanningAgent } from './planning.agent';

const agentInstances = {
  [AgentRole.CONTENT]: new ContentAgent(),
  [AgentRole.RESEARCH]: new ResearchAgent(),
  [AgentRole.COACH]: new CoachingAgent(),
  [AgentRole.ANALYTICS]: new AnalyticsAgent(),
  [AgentRole.PLANNER]: new PlanningAgent(),
} as const;

type SupportedRole = keyof typeof agentInstances;

const SUPPORTED_ROLES: SupportedRole[] = [
  AgentRole.CONTENT,
  AgentRole.RESEARCH,
  AgentRole.COACH,
  AgentRole.ANALYTICS,
  AgentRole.PLANNER,
];

export function getAgent(role: AgentRole): (typeof agentInstances)[SupportedRole] {
  if (!(role in agentInstances)) {
    throw new Error(`No agent registered for role "${role}". Supported: ${SUPPORTED_ROLES.join(', ')}`);
  }
  return agentInstances[role as SupportedRole];
}

export function listAgentRoles(): SupportedRole[] {
  return SUPPORTED_ROLES;
}
