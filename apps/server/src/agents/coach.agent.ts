import { AgentRole, ApprovalState } from '@lyfestack/shared';
import { dailyLoopService } from '../services/dailyLoop.service';
import type { DailyLoopInput, DailyBriefResult } from '../services/dailyLoop.service';
import type { AgentActionRecord } from '../services/agent.service';
import { v4 as uuidv4 } from 'uuid';

export interface CoachInput extends DailyLoopInput {
  rationale?: string;
}

export interface CoachOutput {
  action: AgentActionRecord;
  brief: DailyBriefResult;
}

export function runCoachAgent(input: CoachInput): CoachOutput {
  const brief = dailyLoopService.generateBrief(input);

  const action: AgentActionRecord = {
    id: uuidv4(),
    agentRole: AgentRole.COACH,
    userId: input.userId,
    action: 'generate_daily_brief',
    payload: { date: input.date, streak: input.currentStreak, taskCount: input.plannedTasksToday.length },
    approvalState: ApprovalState.APPROVED,
    rationale: input.rationale ?? `Generated daily brief for ${input.date} with ${input.plannedTasksToday.length} planned tasks.`,
    createdAt: new Date().toISOString(),
  };

  return { action, brief };
}
