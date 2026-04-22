import type { Task } from '@lyfestack/shared';
import { TaskStatus, TaskType } from '@lyfestack/shared';

const TYPE_WEIGHTS: Record<TaskType, number> = {
  [TaskType.MILESTONE]: 3,
  [TaskType.ACTION]: 2,
  [TaskType.HABIT]: 1,
  [TaskType.REFLECTION]: 1,
  [TaskType.SOCIAL]: 1,
};

export interface ScoreResult {
  score: number;
  completedWeight: number;
  totalWeight: number;
  streak: number;
  completionRate: number;
}

export function scoreGoal(tasks: Task[]): ScoreResult {
  if (tasks.length === 0) {
    return { score: 0, completedWeight: 0, totalWeight: 0, streak: 0, completionRate: 0 };
  }

  let totalWeight = 0;
  let completedWeight = 0;

  for (const task of tasks) {
    const weight = TYPE_WEIGHTS[task.type] ?? 1;
    totalWeight += weight;
    if (task.status === TaskStatus.COMPLETED) {
      completedWeight += weight;
    }
  }

  const completionRate = totalWeight > 0 ? completedWeight / totalWeight : 0;
  const streak = computeStreak(tasks);
  const streakBonus = Math.min(streak * 2, 20);
  const score = Math.min(100, Math.round(completionRate * 80 + streakBonus));

  return { score, completedWeight, totalWeight, streak, completionRate };
}

function computeStreak(tasks: Task[]): number {
  const completedDates = tasks
    .filter((t) => t.status === TaskStatus.COMPLETED && t.completedAt)
    .map((t) => t.completedAt!.split('T')[0])
    .filter((d): d is string => d !== undefined)
    .sort();

  if (completedDates.length === 0) return 0;

  const unique = [...new Set(completedDates)];
  let streak = 1;
  let maxStreak = 1;

  for (let i = 1; i < unique.length; i++) {
    const prev = unique[i - 1];
    const curr = unique[i];
    if (!prev || !curr) continue;
    const diff = (new Date(curr).getTime() - new Date(prev).getTime()) / 86_400_000;
    if (diff === 1) {
      streak++;
      maxStreak = Math.max(maxStreak, streak);
    } else {
      streak = 1;
    }
  }

  return maxStreak;
}
