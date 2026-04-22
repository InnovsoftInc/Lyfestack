import type { Task } from '@lyfestack/shared';
import { TaskType } from '@lyfestack/shared';
import type { ScoredTask, ScoringFactors, UserScoringContext } from './scoring.types';

const IMPACT_BY_TYPE: Record<TaskType, number> = {
  [TaskType.MILESTONE]: 0.9,
  [TaskType.ACTION]: 0.7,
  [TaskType.HABIT]: 0.6,
  [TaskType.SOCIAL]: 0.5,
  [TaskType.REFLECTION]: 0.4,
};

const MIN_EFFORT = 1;
const MAX_EFFORT = 5;

export class TaskScorer {
  /**
   * Core scoring formula:
   *   score = (urgency * 0.30) + (impact * 0.30) + (normalizedEffort * 0.15)
   *         + (depsMet * 0.15) + (confidence * 0.10)
   *
   * effort is inverted and normalized: normalizedEffort = (1 / effort) * MAX_EFFORT
   * so effort=1 → 1.0, effort=5 → 0.2
   */
  scoreFactors(factors: ScoringFactors): number {
    const clamp = (v: number) => Math.min(1, Math.max(0, v));
    const effort = Math.min(MAX_EFFORT, Math.max(MIN_EFFORT, factors.effort));
    const normalizedEffort = MIN_EFFORT / effort;

    return (
      clamp(factors.urgency) * 0.30 +
      clamp(factors.impact) * 0.30 +
      normalizedEffort * 0.15 +
      clamp(factors.depsMet) * 0.15 +
      clamp(factors.confidence) * 0.10
    );
  }

  deriveFactors(task: Task, now: Date = new Date()): ScoringFactors {
    // Urgency: time-based, peaks in the 24h before scheduledFor
    let urgency = 0.5;
    if (task.scheduledFor) {
      const scheduledMs = new Date(task.scheduledFor).getTime();
      const nowMs = now.getTime();
      const hoursUntil = (scheduledMs - nowMs) / (1000 * 60 * 60);
      if (hoursUntil <= 0) {
        urgency = 1.0;
      } else if (hoursUntil <= 24) {
        urgency = 0.7 + (1 - hoursUntil / 24) * 0.3;
      } else if (hoursUntil <= 72) {
        urgency = 0.4 + (1 - hoursUntil / 72) * 0.3;
      } else {
        urgency = Math.max(0.1, 0.4 - hoursUntil / (7 * 24) * 0.3);
      }
    }

    // Impact: derived from task type
    const impact = IMPACT_BY_TYPE[task.type] ?? 0.5;

    // Effort: derived from durationMinutes (15m=1, 30m=2, 60m=3, 90m=4, 120m+=5)
    const mins = task.durationMinutes ?? 30;
    const effort = Math.min(5, Math.max(1, Math.ceil(mins / 30)));

    return { urgency, impact, effort, depsMet: 1.0, confidence: 0.7 };
  }

  scoreTask(task: Task, now?: Date): ScoredTask {
    const factors = this.deriveFactors(task, now);
    return { task, score: this.scoreFactors(factors), factors };
  }

  rankTasks(tasks: Task[], context: UserScoringContext, now?: Date): ScoredTask[] {
    const scored = tasks.map((t) => this.scoreTask(t, now));
    scored.sort((a, b) => b.score - a.score);
    const cap = this.adaptiveTaskCap(context);
    return scored.slice(0, cap);
  }

  adaptiveTaskCap(context: UserScoringContext): number {
    if (context.taskCap !== undefined) return context.taskCap;
    // Base cap of 3, scales to 7 based on engagement velocity (0–1)
    return Math.round(3 + context.engagementVelocity * 4);
  }
}

export const taskScorer = new TaskScorer();
