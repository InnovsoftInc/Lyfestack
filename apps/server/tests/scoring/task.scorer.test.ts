import { TaskScorer } from '../../src/engine/scoring/task.scorer';
import { TaskStatus, TaskType, ApprovalState } from '@lyfestack/shared';
import type { Task } from '@lyfestack/shared';
import type { ScoringFactors } from '../../src/engine/scoring/scoring.types';

const scorer = new TaskScorer();

function makeTask(overrides: Partial<Task> = {}): Task {
  return {
    id: 'task-1',
    goalId: 'goal-1',
    userId: 'user-1',
    title: 'Test task',
    type: TaskType.ACTION,
    status: TaskStatus.PENDING,
    approvalState: ApprovalState.APPROVED,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  };
}

describe('TaskScorer.scoreFactors', () => {
  test('returns score between 0 and 1', () => {
    const factors: ScoringFactors = { urgency: 0.8, impact: 0.7, effort: 2, depsMet: 1.0, confidence: 0.9 };
    const score = scorer.scoreFactors(factors);
    expect(score).toBeGreaterThanOrEqual(0);
    expect(score).toBeLessThanOrEqual(1);
  });

  test('high urgency and impact produces high score', () => {
    const high: ScoringFactors = { urgency: 1, impact: 1, effort: 1, depsMet: 1, confidence: 1 };
    const low: ScoringFactors = { urgency: 0, impact: 0, effort: 5, depsMet: 0, confidence: 0 };
    expect(scorer.scoreFactors(high)).toBeGreaterThan(scorer.scoreFactors(low));
  });

  test('effort=1 produces higher score than effort=5 (same other factors)', () => {
    const easyTask: ScoringFactors = { urgency: 0.5, impact: 0.5, effort: 1, depsMet: 0.5, confidence: 0.5 };
    const hardTask: ScoringFactors = { urgency: 0.5, impact: 0.5, effort: 5, depsMet: 0.5, confidence: 0.5 };
    expect(scorer.scoreFactors(easyTask)).toBeGreaterThan(scorer.scoreFactors(hardTask));
  });

  test('formula weights sum correctly at max inputs', () => {
    const maxFactors: ScoringFactors = { urgency: 1, impact: 1, effort: 1, depsMet: 1, confidence: 1 };
    const score = scorer.scoreFactors(maxFactors);
    // effort=1 → normalizedEffort = 1/1 = 1.0
    // expected = 0.30 + 0.30 + 0.15 + 0.15 + 0.10 = 1.0
    expect(score).toBeCloseTo(1.0, 5);
  });

  test('clamps out-of-range factors', () => {
    const outOfRange: ScoringFactors = { urgency: 2, impact: -1, effort: 3, depsMet: 1.5, confidence: -0.5 };
    const score = scorer.scoreFactors(outOfRange);
    expect(score).toBeGreaterThanOrEqual(0);
    expect(score).toBeLessThanOrEqual(1);
  });
});

describe('TaskScorer.deriveFactors', () => {
  test('overdue task gets urgency=1', () => {
    const task = makeTask({
      scheduledFor: new Date(Date.now() - 3600_000).toISOString(),
    });
    const factors = scorer.deriveFactors(task);
    expect(factors.urgency).toBe(1.0);
  });

  test('task in 12h gets urgency > 0.7', () => {
    const task = makeTask({
      scheduledFor: new Date(Date.now() + 12 * 3600_000).toISOString(),
    });
    const factors = scorer.deriveFactors(task);
    expect(factors.urgency).toBeGreaterThan(0.7);
  });

  test('MILESTONE type gets highest impact', () => {
    const task = makeTask({ type: TaskType.MILESTONE });
    const factors = scorer.deriveFactors(task);
    expect(factors.impact).toBe(0.9);
  });

  test('REFLECTION type gets lowest impact', () => {
    const reflectionTask = makeTask({ type: TaskType.REFLECTION });
    const milestoneTask = makeTask({ type: TaskType.MILESTONE });
    expect(scorer.deriveFactors(reflectionTask).impact).toBeLessThan(
      scorer.deriveFactors(milestoneTask).impact,
    );
  });

  test('60-minute task gets effort=2', () => {
    const task = makeTask({ durationMinutes: 60 });
    const factors = scorer.deriveFactors(task);
    expect(factors.effort).toBe(2);
  });
});

describe('TaskScorer.adaptiveTaskCap', () => {
  test('engagement 0 returns cap of 3', () => {
    expect(scorer.adaptiveTaskCap({ userId: 'u1', engagementVelocity: 0 })).toBe(3);
  });

  test('engagement 1 returns cap of 7', () => {
    expect(scorer.adaptiveTaskCap({ userId: 'u1', engagementVelocity: 1 })).toBe(7);
  });

  test('explicit taskCap overrides computation', () => {
    expect(scorer.adaptiveTaskCap({ userId: 'u1', engagementVelocity: 0.5, taskCap: 5 })).toBe(5);
  });
});

describe('TaskScorer.rankTasks', () => {
  test('returns tasks sorted by descending score', () => {
    const tasks: Task[] = [
      makeTask({ id: 't1', type: TaskType.REFLECTION, durationMinutes: 90 }),
      makeTask({ id: 't2', type: TaskType.MILESTONE, durationMinutes: 15, scheduledFor: new Date(Date.now() + 3600_000).toISOString() }),
      makeTask({ id: 't3', type: TaskType.ACTION, durationMinutes: 30 }),
    ];
    const ranked = scorer.rankTasks(tasks, { userId: 'u1', engagementVelocity: 1 });
    for (let i = 0; i < ranked.length - 1; i++) {
      expect(ranked[i]!.score).toBeGreaterThanOrEqual(ranked[i + 1]!.score);
    }
  });

  test('respects adaptive cap', () => {
    const tasks: Task[] = Array.from({ length: 10 }, (_, i) =>
      makeTask({ id: `t${i}` }),
    );
    const ranked = scorer.rankTasks(tasks, { userId: 'u1', engagementVelocity: 0 });
    expect(ranked.length).toBe(3);
  });
});
