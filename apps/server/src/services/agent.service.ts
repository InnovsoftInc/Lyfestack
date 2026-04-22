import type { AgentRole, ApprovalState } from '@lyfestack/shared';
import { runPlannerAgent } from '../agents/planner.agent';
import type { PlannerInput } from '../agents/planner.agent';
import { runCoachAgent } from '../agents/coach.agent';
import type { CoachInput } from '../agents/coach.agent';
import { runReviewerAgent } from '../agents/reviewer.agent';
import type { ReviewerInput } from '../agents/reviewer.agent';
import { ValidationError } from '../errors/AppError';

export interface AgentActionRecord {
  id: string;
  agentRole: AgentRole;
  userId: string;
  action: string;
  payload: unknown;
  approvalState: ApprovalState;
  rationale: string;
  createdAt: string;
  resolvedAt?: string;
}

type AgentRunInput =
  | { role: 'PLANNER'; input: PlannerInput }
  | { role: 'COACH'; input: CoachInput }
  | { role: 'REVIEWER'; input: ReviewerInput };

export interface AgentRunResult {
  action: AgentActionRecord;
  output: unknown;
}

export class AgentService {
  private readonly actionLog: AgentActionRecord[] = [];

  run(request: AgentRunInput): AgentRunResult {
    let result: AgentRunResult;

    if (request.role === 'PLANNER') {
      const { action, plan } = runPlannerAgent(request.input);
      this.actionLog.push(action);
      result = { action, output: plan };
    } else if (request.role === 'COACH') {
      const { action, brief } = runCoachAgent(request.input);
      this.actionLog.push(action);
      result = { action, output: brief };
    } else if (request.role === 'REVIEWER') {
      const { action, scoreResult, summary } = runReviewerAgent(request.input);
      this.actionLog.push(action);
      result = { action, output: { scoreResult, summary } };
    } else {
      throw new ValidationError(`Unknown agent role: ${String((request as { role: string }).role)}`);
    }

    return result;
  }

  listActions(userId?: string): AgentActionRecord[] {
    if (userId) {
      return this.actionLog.filter((a) => a.userId === userId);
    }
    return [...this.actionLog];
  }
}

export const agentService = new AgentService();
