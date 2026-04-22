import type { Task } from '@lyfestack/shared';
import { TaskStatus } from '@lyfestack/shared';
import { taskScorer } from './task.scorer';
import type { ScoredTask, UserScoringContext } from './scoring.types';

export class ScoringService {
  rankPendingTasks(allTasks: Task[], context: UserScoringContext): ScoredTask[] {
    const pending = allTasks.filter(
      (t) =>
        t.status === TaskStatus.PENDING ||
        t.status === TaskStatus.APPROVED ||
        t.status === TaskStatus.IN_PROGRESS,
    );
    return taskScorer.rankTasks(pending, context);
  }

  scoreTask(task: Task): ScoredTask {
    return taskScorer.scoreTask(task);
  }
}

export const scoringService = new ScoringService();
