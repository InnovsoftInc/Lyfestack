import { TaskScorer } from '../../../src/engine/scoring/TaskScorer';
import type { ScoringFactors } from '../../../src/engine/scoring/types';
import { TaskStatus, TaskType, ApprovalState } from '@lyfestack/shared';
import type { Task } from '@lyfestack/shared';

const scorer = new TaskScorer();

const makeTask = (overrides: Partial<Task> = {}): Task => ({
  id: 'task-1',
  goalId: 'goal-1',
  userId: 'user-1',
  title: 'Test task',
  type: TaskType.ACTION,
  status: TaskStatus.PENDING,
  approvalState: ApprovalState.PENDING,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  ...overrides,
});

const makeFactors = (overrides: Partial<ScoringFactors> = {}): ScoringFactors => ({
  urgency: 0.5,
  impact: 0.5,
  effort: 0.5,
  dependenciesMet: 1,
  confidence: 0.7,
  ...overrides,
});

describe('TaskScorer', () => {
  describe('scoreTask', () => {
    it('produces a score in [0, 1]', () => {
      const result = scorer.scoreTask(makeTask(), makeFactors());
      expect(result.score).toBeGreaterThanOrEqual(0);
      expect(result.score).toBeLessThanOrEqual(1);
    });

    it('high urgency + high impact → high score', () => {
      const high = scorer.scoreTask(makeTask(), makeFactors({ urgency: 1, impact: 1, effort: 0.1, dependenciesMet: 1, confidence: 1 }));
      const low = scorer.scoreTask(makeTask(), makeFactors({ urgency: 0, impact: 0, effort: 1, dependenciesMet: 0, confidence: 0 }));
      expect(high.score).toBeGreaterThan(low.score);
    });

    it('low effort increases score vs high effort (all else equal)', () => {
      const easy = scorer.scoreTask(makeTask(), makeFactors({ effort: 0.1 }));
      const hard = scorer.scoreTask(makeTask(), makeFactors({ effort: 0.9 }));
      expect(easy.score).toBeGreaterThan(hard.score);
    });

    it('blocked task (dependenciesMet=0) scores lower than unblocked', () => {
      const unblocked = scorer.scoreTask(makeTask(), makeFactors({ dependenciesMet: 1 }));
      const blocked = scorer.scoreTask(makeTask(), makeFactors({ dependenciesMet: 0 }));
      expect(unblocked.score).toBeGreaterThan(blocked.score);
    });

    it('weights sum to 1.0 for perfect factors', () => {
      const result = scorer.scoreTask(
        makeTask(),
        makeFactors({ urgency: 1, impact: 1, effort: 0, dependenciesMet: 1, confidence: 1 }),
      );
      expect(result.score).toBeCloseTo(1.0, 2);
    });
  });

  describe('scoreAll', () => {
    it('ranks tasks in descending order', () => {
      const tasks = [
        makeTask({ id: 't1', title: 'Low priority' }),
        makeTask({ id: 't2', title: 'High priority' }),
      ];
      const map = new Map([
        ['t1', makeFactors({ urgency: 0.1, impact: 0.1 })],
        ['t2', makeFactors({ urgency: 0.9, impact: 0.9 })],
      ]);
      const results = scorer.scoreAll(tasks, map);
      expect(results[0]!.task.id).toBe('t2');
      expect(results[1]!.task.id).toBe('t1');
      expect(results[0]!.rank).toBe(1);
      expect(results[1]!.rank).toBe(2);
    });

    it('handles empty task list', () => {
      expect(scorer.scoreAll([], new Map())).toEqual([]);
    });
  });

  describe('inferFactors', () => {
    it('overdue task gets urgency 1', () => {
      const yesterday = new Date(Date.now() - 86400000).toISOString();
      const task = makeTask({ scheduledFor: yesterday });
      const factors = scorer.inferFactors(task);
      expect(factors.urgency).toBe(1);
    });

    it('MILESTONE type gets highest impact', () => {
      const task = makeTask({ type: TaskType.MILESTONE });
      const factors = scorer.inferFactors(task);
      expect(factors.impact).toBe(0.9);
    });

    it('short task has lower effort than long task', () => {
      const short = scorer.inferFactors(makeTask({ durationMinutes: 10 }));
      const long = scorer.inferFactors(makeTask({ durationMinutes: 120 }));
      expect(short.effort).toBeLessThan(long.effort);
    });
  });
});
