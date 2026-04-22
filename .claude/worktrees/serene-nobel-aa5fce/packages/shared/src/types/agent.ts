import type { AgentRole } from '../enums/agent.enums';
import type { ApprovalState } from '../enums/task.enums';

export interface AgentAction {
  id: string;
  agentRole: AgentRole;
  userId: string;
  action: string;
  payload: Record<string, unknown>;
  approvalState: ApprovalState;
  rationale: string;
  createdAt: string;
  resolvedAt?: string;
}
