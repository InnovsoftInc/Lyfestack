import { AgentRole, ApprovalState } from '@lyfestack/shared';
import { generatePlan } from '../engine/planningEngine';
import type { PlanGenerationInput, GeneratedPlan } from '../engine/planningEngine';
import type { AgentActionRecord } from '../services/agent.service';
import { v4 as uuidv4 } from 'uuid';

export interface PlannerInput {
  userId: string;
  templateId: string;
  startDate: string;
  diagnosticAnswers: Record<string, string | number>;
  rationale?: string;
}

export interface PlannerOutput {
  action: AgentActionRecord;
  plan: GeneratedPlan;
}

export function runPlannerAgent(input: PlannerInput): PlannerOutput {
  const planInput: PlanGenerationInput = {
    userId: input.userId,
    templateId: input.templateId,
    startDate: input.startDate,
    diagnosticAnswers: input.diagnosticAnswers,
  };

  const plan = generatePlan(planInput);

  const action: AgentActionRecord = {
    id: uuidv4(),
    agentRole: AgentRole.PLANNER,
    userId: input.userId,
    action: 'generate_plan',
    payload: { templateId: input.templateId, startDate: input.startDate, planId: plan.id },
    approvalState: ApprovalState.PENDING,
    rationale: input.rationale ?? `Generated ${plan.totalWeeks}-week plan from template '${input.templateId}' starting ${input.startDate}.`,
    createdAt: new Date().toISOString(),
  };

  return { action, plan };
}
