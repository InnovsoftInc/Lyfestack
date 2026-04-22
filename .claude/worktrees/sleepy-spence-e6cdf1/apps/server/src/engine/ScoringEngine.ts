export interface ScoringInput {
  goalId: string;
  templateId: string;
  totalMilestones: number;
  completedMilestones: number;
  totalTasksScheduled: number;
  completedTasks: number;
  currentStreak: number;
  daysElapsed: number;
  leadingIndicatorScores?: Record<string, number> | undefined;
}

export interface ScoreBreakdown {
  milestoneScore: number;
  taskCompletionScore: number;
  consistencyScore: number;
  leadingIndicatorScore: number;
}

export type ScoreGrade = 'A' | 'B' | 'C' | 'D' | 'F';

export interface ScoreResult {
  goalId: string;
  totalScore: number;
  breakdown: ScoreBreakdown;
  weights: {
    milestone: number;
    taskCompletion: number;
    consistency: number;
    leadingIndicator: number;
  };
  grade: ScoreGrade;
  calculatedAt: string;
}

const WEIGHTS = {
  milestone: 0.4,
  taskCompletion: 0.35,
  consistency: 0.15,
  leadingIndicator: 0.1,
} as const;

function clamp(value: number, min = 0, max = 100): number {
  return Math.max(min, Math.min(max, value));
}

function toGrade(score: number): ScoreGrade {
  if (score >= 90) return 'A';
  if (score >= 75) return 'B';
  if (score >= 60) return 'C';
  if (score >= 45) return 'D';
  return 'F';
}

function milestoneScore(completed: number, total: number): number {
  if (total === 0) return 100;
  return clamp((completed / total) * 100);
}

function taskCompletionScore(completed: number, scheduled: number): number {
  if (scheduled === 0) return 100;
  return clamp((completed / scheduled) * 100);
}

function consistencyScore(streak: number, daysElapsed: number): number {
  if (daysElapsed === 0) return 100;
  return clamp((streak / daysElapsed) * 100);
}

function leadingIndicatorScore(scores: Record<string, number> | undefined | null): number {
  if (!scores) return 50;
  const values = Object.values(scores).filter((v): v is number => typeof v === 'number');
  if (values.length === 0) return 50;
  const avg = values.reduce((sum, v) => sum + v, 0) / values.length;
  return clamp(avg);
}

export function calculateScore(input: ScoringInput): ScoreResult {
  const ms = milestoneScore(input.completedMilestones, input.totalMilestones);
  const ts = taskCompletionScore(input.completedTasks, input.totalTasksScheduled);
  const cs = consistencyScore(input.currentStreak, input.daysElapsed);
  const ls = leadingIndicatorScore(input.leadingIndicatorScores);

  const total = clamp(
    ms * WEIGHTS.milestone +
      ts * WEIGHTS.taskCompletion +
      cs * WEIGHTS.consistency +
      ls * WEIGHTS.leadingIndicator,
  );

  return {
    goalId: input.goalId,
    totalScore: Math.round(total * 10) / 10,
    breakdown: {
      milestoneScore: Math.round(ms * 10) / 10,
      taskCompletionScore: Math.round(ts * 10) / 10,
      consistencyScore: Math.round(cs * 10) / 10,
      leadingIndicatorScore: Math.round(ls * 10) / 10,
    },
    weights: {
      milestone: WEIGHTS.milestone,
      taskCompletion: WEIGHTS.taskCompletion,
      consistency: WEIGHTS.consistency,
      leadingIndicator: WEIGHTS.leadingIndicator,
    },
    grade: toGrade(total),
    calculatedAt: new Date().toISOString(),
  };
}
