import { request } from './api';

export interface AgentOutput {
  agentKey: string;
  result: unknown;
  actions?: AgentAction[];
}

export interface AgentAction {
  id: string;
  agentRole: string;
  userId: string;
  action: string;
  payload: Record<string, unknown>;
  approvalState: string;
  rationale: string;
  createdAt: string;
  resolvedAt?: string;
}

export interface ExecuteAgentPayload {
  agentKey: string;
  userId: string;
  prompt: string;
  context?: Record<string, unknown>;
  requestedActions?: string[];
}

export async function executeAgent(payload: ExecuteAgentPayload): Promise<AgentOutput> {
  const res = await request<{ output: AgentOutput }>('/agents/execute', {
    method: 'POST',
    body: payload,
  });
  return res.output;
}

export async function getAgentActions(): Promise<AgentAction[]> {
  const res = await request<{ agents: AgentAction[] }>('/agents/actions');
  return res.agents;
}
