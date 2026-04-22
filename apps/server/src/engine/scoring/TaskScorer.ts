import type { Task } from '@lyfestack/shared';
import { TaskType } from '@lyfestack/shared';
import type { ScoringFactors, ScoredTask } from './types';

const WEIGHTS = {
  urgency: 0.30,
  impact: 0.30,
  effort: 0.15,       // contribution is 1/effort * weight (low effort = higher score)
  dependenciesMet: 0.15,
  confidence: 0.10,
} as const;

export class TaskScorer {
  /**
   * Core scoring formula:
   * score = (urgency * 0.3) + (impact * 0.3) + (1/effort * 0.15) + (dependenciesMet * 0.15) + (confidence * 0.1)
   * All factors normalized to [0, 1].
   */
  scoreTask(task: Task, factors: ScoringFactors): ScoredTask {
    const { urgency, impact, effort, dependenciesMet, confidence } = factors;

    const normalizedEffort = Math.max(0, Math.min(1, effort));
    const effortScore = 1 - normalizedEffort; // invert: low effort → high score

    const score =
      urgency * WEIGHTS.urgency +
      impact * WEIGHTS.impact +
      effortScore * WEIGHTS.effort +
      dependenciesMet * WEIGHTS.dependenciesMet +
      confidence * WEIGHTS.confidence;

    return {
      task,
      score: Math.max(0, Math.min(1, score)),
      factors,
      rank: 0, // set after sorting
      isAutomation: task.type === TaskType.MILESTONE && task.approvalState === 'APPROVED',
    };
  }

  scoreAll(tasks: Task[], factorsMap: Map<string, ScoringFactors>): ScoredTask[] {
    const scored = tasks.map((task) => {
      const factors = factorsMap.get(task.id) ?? this.inferFactors(task);
      return this.scoreTask(task, factors);
    });

    scored.sort((a, b) => b.score - a.score);
    scored.forEach((s, i) => (s.rank = i + 1));

    return scored;
  }

  /** Infers reasonable default factors from task properties when explicit scores aren't provided. */
  inferFactors(task: Task): ScoringFactors {
    const now = Date.now();
    const scheduled = task.scheduledFor ? new Date(task.scheduledFor).getTime() : now + 86400000;
    const hoursUntilDue = (scheduled - now) / 3600000;

    const urgency = hoursUntilDue <= 0 ? 1 : hoursUntilDue <= 24 ? 0.9 : hoursUntilDue <= 72 ? 0.6 : 0.3;
    const effortByDuration = task.durationMinutes
      ? Math.min(1, task.durationMinutes / 120) // 2h = max effort
      : 0.5;

    const impactByType: Record<string, number> = {
      MILESTONE: 0.9,
      ACTION: 0.7,
      HABIT: 0.6,
      REFLECTION: 0.4,
      SOCIAL: 0.5,
    };

    return {
      urgency,
      impact: impactByType[task.type] ?? 0.5,
      effort: effortByDuration,
      dependenciesMet: 1, // assume unblocked unless told otherwise
      confidence: 0.7,
    };
  }
}

export const taskScorer = new TaskScorer();
