import { AgentRole } from '@lyfestack/shared';
import { BaseAgent, AgentInput, AgentOutput } from './BaseAgent';
import { ValidationError } from '../errors/AppError';

export class ReviewerAgent extends BaseAgent {
  readonly role = AgentRole.REVIEWER;
  readonly supportedActions = [
    'REVIEW_WEEK',
    'UPDATE_SCORE',
    'FLAG_RISK',
    'CONFIRM_MILESTONE',
    'GENERATE_INSIGHT',
  ];

  process(input: AgentInput): AgentOutput {
    switch (input.action) {
      case 'REVIEW_WEEK':
        return this.reviewWeek(input);
      case 'UPDATE_SCORE':
        return this.updateScore(input);
      case 'FLAG_RISK':
        return this.flagRisk(input);
      case 'CONFIRM_MILESTONE':
        return this.confirmMilestone(input);
      case 'GENERATE_INSIGHT':
        return this.generateInsight(input);
      default:
        throw new ValidationError(`ReviewerAgent does not support action: ${input.action}`);
    }
  }

  private reviewWeek(input: AgentInput): AgentOutput {
    const { goalId, weekNumber, completedTasks, totalTasks } = input.payload;
    const rate = typeof completedTasks === 'number' && typeof totalTasks === 'number' && totalTasks > 0
      ? Math.round((completedTasks / totalTasks) * 100)
      : 0;
    const verdict = rate >= 80 ? 'strong' : rate >= 50 ? 'moderate' : 'needs_attention';

    return this.buildOutput(
      input,
      { goalId, weekNumber, completionRate: rate, verdict },
      `Week ${String(weekNumber)} review: ${rate}% completion rate (${verdict}).`,
      rate < 50 ? ['FLAG_RISK', 'ADJUST_MILESTONES'] : ['UPDATE_SCORE'],
    );
  }

  private updateScore(input: AgentInput): AgentOutput {
    const { goalId, newScore, previousScore } = input.payload;
    const delta = typeof newScore === 'number' && typeof previousScore === 'number'
      ? newScore - previousScore
      : 0;

    return this.buildOutput(
      input,
      { goalId, newScore, delta },
      `Score updated: ${String(previousScore)} → ${String(newScore)} (${delta >= 0 ? '+' : ''}${delta}).`,
      ['GENERATE_INSIGHT'],
    );
  }

  private flagRisk(input: AgentInput): AgentOutput {
    const { goalId, riskType, severity } = input.payload;
    return this.buildOutput(
      input,
      { goalId, riskType, severity, flaggedAt: new Date().toISOString() },
      `Risk flagged for goal ${String(goalId)}: ${String(riskType)} (severity: ${String(severity)}).`,
      ['NOTIFY_COACH', 'SUGGEST_ADJUSTMENT'],
    );
  }

  private confirmMilestone(input: AgentInput): AgentOutput {
    const { milestoneId, goalId, confirmedAt } = input.payload;
    return this.buildOutput(
      input,
      { milestoneId, goalId, confirmedAt, status: 'confirmed' },
      `Milestone ${String(milestoneId)} confirmed complete for goal ${String(goalId)}.`,
      ['UPDATE_SCORE', 'CELEBRATE_MILESTONE'],
    );
  }

  private generateInsight(input: AgentInput): AgentOutput {
    const { goalId, scoreHistory, streakData } = input.payload;
    const trend =
      Array.isArray(scoreHistory) && scoreHistory.length >= 2
        ? (scoreHistory[scoreHistory.length - 1] as number) >
          (scoreHistory[scoreHistory.length - 2] as number)
          ? 'improving'
          : 'declining'
        : 'stable';

    return this.buildOutput(
      input,
      { goalId, trend, streakData, insight: `Performance trend is ${trend}.` },
      `Generated insight for goal ${String(goalId)}: trend is ${trend}.`,
      trend === 'declining' ? ['FLAG_RISK'] : [],
    );
  }
}
