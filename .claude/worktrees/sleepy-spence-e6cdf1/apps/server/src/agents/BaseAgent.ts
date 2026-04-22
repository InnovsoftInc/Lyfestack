import { v4 as uuidv4 } from 'uuid';
import { AgentRole, ApprovalState, TrustTier } from '@lyfestack/shared';

export interface AgentInput {
  userId: string;
  action: string;
  payload: Record<string, unknown>;
  trustTier?: TrustTier | undefined;
}

export interface AgentOutput {
  id: string;
  agentRole: AgentRole;
  userId: string;
  action: string;
  payload: Record<string, unknown>;
  approvalState: ApprovalState;
  rationale: string;
  suggestedNextActions: string[];
  createdAt: string;
}

export abstract class BaseAgent {
  abstract readonly role: AgentRole;
  abstract readonly supportedActions: string[];

  protected buildOutput(
    input: AgentInput,
    resultPayload: Record<string, unknown>,
    rationale: string,
    suggestedNextActions: string[] = [],
  ): AgentOutput {
    const tier = input.trustTier ?? TrustTier.MANUAL;
    const approvalState =
      tier === TrustTier.AUTONOMOUS ? ApprovalState.APPROVED : ApprovalState.PENDING;

    return {
      id: uuidv4(),
      agentRole: this.role,
      userId: input.userId,
      action: input.action,
      payload: resultPayload,
      approvalState,
      rationale,
      suggestedNextActions,
      createdAt: new Date().toISOString(),
    };
  }

  abstract process(input: AgentInput): AgentOutput;
}
