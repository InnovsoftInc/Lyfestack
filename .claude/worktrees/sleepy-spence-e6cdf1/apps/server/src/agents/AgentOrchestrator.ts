import { AgentRole } from '@lyfestack/shared';
import { BaseAgent, AgentInput, AgentOutput } from './BaseAgent';
import { PlannerAgent } from './PlannerAgent';
import { ExecutorAgent } from './ExecutorAgent';
import { ReviewerAgent } from './ReviewerAgent';
import { CoachAgent } from './CoachAgent';
import { ValidationError } from '../errors/AppError';

const agents: BaseAgent[] = [
  new PlannerAgent(),
  new ExecutorAgent(),
  new ReviewerAgent(),
  new CoachAgent(),
];

const agentMap = new Map<AgentRole, BaseAgent>(agents.map((a) => [a.role, a]));

export interface OrchestratorInput extends AgentInput {
  agentRole: AgentRole;
}

export function dispatch(input: OrchestratorInput): AgentOutput {
  const agent = agentMap.get(input.agentRole);
  if (!agent) {
    throw new ValidationError(`Unknown agent role: ${input.agentRole}`);
  }
  return agent.process(input);
}

export function listAgents(): Array<{ role: AgentRole; supportedActions: string[] }> {
  return agents.map((a) => ({ role: a.role, supportedActions: a.supportedActions }));
}
