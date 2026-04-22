import { taskRepository } from '../repositories/task.repository';
import { taskScorer } from '../engine/scoring/TaskScorer';
import type { ScoredTask, ScoringContext } from '../engine/scoring/types';

const BASE_TASK_CAP = 5;
const MAX_TASK_CAP = 10;
const MIN_TASK_CAP = 2;

export class ScoringService {
  /** Returns top N scored tasks for a user, capped by engagement velocity. */
  async scoreTasksForUser(userId: string, context?: Partial<ScoringContext>): Promise<ScoredTask[]> {
    const pendingTasks = await taskRepository.findPendingByUserId(userId);
    if (pendingTasks.length === 0) return [];

    const velocity = context?.engagementVelocity ?? 0.5;
    const cap = this.adaptiveTaskCap(velocity);
    const factorsMap = new Map(pendingTasks.map((t) => [t.id, taskScorer.inferFactors(t)]));
    const scored = taskScorer.scoreAll(pendingTasks, factorsMap);

    return scored.slice(0, cap);
  }

  /** Scales the daily task cap based on recent engagement: fast completers get more tasks. */
  adaptiveTaskCap(velocity: number): number {
    const clamped = Math.max(0, Math.min(1, velocity));
    const raw = MIN_TASK_CAP + clamped * (MAX_TASK_CAP - MIN_TASK_CAP);
    return Math.round(raw);
  }

  /** Separates a scored list into user-action tasks vs system automations. */
  partition(scored: ScoredTask[]) {
    return {
      actions: scored.filter((s) => !s.isAutomation),
      automations: scored.filter((s) => s.isAutomation),
    };
  }
}

export const scoringService = new ScoringService();
