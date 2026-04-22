import { AgentRole, ApprovalState } from '@lyfestack/shared';
import { scoringService } from '../services/scoring.service';
import type { ScoreInput, ScoreResult } from '../services/scoring.service';
import type { AgentActionRecord } from '../services/agent.service';
import { v4 as uuidv4 } from 'uuid';

export interface ReviewerInput extends ScoreInput {
  userId: string;
  periodLabel: string;
  rationale?: string;
}

export interface ReviewerOutput {
  action: AgentActionRecord;
  scoreResult: ScoreResult;
  summary: string;
}

function buildSummary(result: ScoreResult, periodLabel: string): string {
  const lines = [
    `Period: ${periodLabel}`,
    `Overall score: ${result.overall}/100 (${result.grade})`,
    `Tasks: ${result.breakdown.taskScore.toFixed(1)}/60 | Milestones: ${result.breakdown.milestoneScore.toFixed(1)}/30 | Streak bonus: ${result.breakdown.streakBonus.toFixed(1)}/10`,
    '',
    'Insights:',
    ...result.insights.map((i) => `  • ${i}`),
  ];
  return lines.join('\n');
}

export function runReviewerAgent(input: ReviewerInput): ReviewerOutput {
  const scoreResult = scoringService.calculate(input);
  const summary = buildSummary(scoreResult, input.periodLabel);

  const action: AgentActionRecord = {
    id: uuidv4(),
    agentRole: AgentRole.REVIEWER,
    userId: input.userId,
    action: 'review_period',
    payload: { periodLabel: input.periodLabel, score: scoreResult.overall, grade: scoreResult.grade },
    approvalState: ApprovalState.APPROVED,
    rationale: input.rationale ?? `Reviewed period '${input.periodLabel}' — score ${scoreResult.overall} (${scoreResult.grade}).`,
    createdAt: new Date().toISOString(),
  };

  return { action, scoreResult, summary };
}
