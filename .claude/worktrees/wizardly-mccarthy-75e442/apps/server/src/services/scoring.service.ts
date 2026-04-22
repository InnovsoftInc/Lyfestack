export interface IndicatorScore {
  metric: string;
  value: number;
  target: number;
}

export interface ScoreInput {
  completedTasks: number;
  expectedTasks: number;
  completedMilestones: number;
  totalMilestones: number;
  currentStreak: number;
  leadingIndicatorScores: IndicatorScore[];
}

export interface ScoreBreakdown {
  taskScore: number;
  milestoneScore: number;
  streakBonus: number;
  indicatorScore: number;
}

export type Grade = 'A' | 'B' | 'C' | 'D' | 'F';

export interface ScoreResult {
  overall: number;
  breakdown: ScoreBreakdown;
  grade: Grade;
  insights: string[];
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

function toGrade(score: number): Grade {
  if (score >= 90) return 'A';
  if (score >= 80) return 'B';
  if (score >= 70) return 'C';
  if (score >= 60) return 'D';
  return 'F';
}

function buildInsights(input: ScoreInput, breakdown: ScoreBreakdown): string[] {
  const insights: string[] = [];

  const taskRate =
    input.expectedTasks > 0 ? input.completedTasks / input.expectedTasks : 0;

  if (taskRate < 0.5) {
    insights.push('Task completion is below 50% — try breaking tasks into smaller steps.');
  } else if (taskRate >= 0.9) {
    insights.push('Excellent task completion rate! Consider increasing your daily targets.');
  }

  if (input.currentStreak >= 7) {
    insights.push(`${input.currentStreak}-day streak — momentum is building, keep it going.`);
  } else if (input.currentStreak === 0) {
    insights.push('No active streak — complete one task today to restart your momentum.');
  }

  if (breakdown.milestoneScore < 20 && input.totalMilestones > 0) {
    insights.push('Milestones are lagging — review upcoming milestones and prioritize sprint tasks.');
  }

  const underperformingIndicators = input.leadingIndicatorScores.filter(
    (li) => li.target > 0 && li.value / li.target < 0.6,
  );
  if (underperformingIndicators.length > 0) {
    const names = underperformingIndicators.map((li) => li.metric).join(', ');
    insights.push(`Leading indicators below 60% of target: ${names}.`);
  }

  if (insights.length === 0) {
    insights.push("You're on track — stay consistent and the results will compound.");
  }

  return insights;
}

export class ScoringService {
  calculate(input: ScoreInput): ScoreResult {
    const taskScore =
      input.expectedTasks > 0
        ? clamp((input.completedTasks / input.expectedTasks) * 60, 0, 60)
        : 0;

    const milestoneScore =
      input.totalMilestones > 0
        ? clamp((input.completedMilestones / input.totalMilestones) * 30, 0, 30)
        : 0;

    const streakBonus = clamp(input.currentStreak * 0.5, 0, 10);

    const indicatorScore =
      input.leadingIndicatorScores.length > 0
        ? clamp(
            input.leadingIndicatorScores.reduce((sum, li) => {
              const ratio = li.target > 0 ? clamp(li.value / li.target, 0, 1) : 0;
              return sum + ratio;
            }, 0) /
              input.leadingIndicatorScores.length *
              10,
            0,
            10,
          )
        : 0;

    const breakdown: ScoreBreakdown = {
      taskScore: Math.round(taskScore * 10) / 10,
      milestoneScore: Math.round(milestoneScore * 10) / 10,
      streakBonus: Math.round(streakBonus * 10) / 10,
      indicatorScore: Math.round(indicatorScore * 10) / 10,
    };

    const raw = taskScore + milestoneScore + streakBonus + indicatorScore;
    const overall = Math.round(clamp(raw, 0, 100));

    return {
      overall,
      breakdown,
      grade: toGrade(overall),
      insights: buildInsights(input, breakdown),
    };
  }
}

export const scoringService = new ScoringService();
