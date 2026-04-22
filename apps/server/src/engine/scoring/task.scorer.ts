import { Task, TaskType } from '@lyfestack/shared';

export interface ScoredTask {
  task: Task;
  score: number;
  breakdown: {
    urgency: number;
    impact: number;
    effort: number;
    dependenciesMet: number;
    confidence: number;
  };
}

const WEIGHTS = {
  urgency: 0.30,
  impact: 0.30,
  effort: 0.15,
  dependencies: 0.15,
  confidence: 0.10,
};

export class TaskScorer {
  scoreTask(task: Task, now: Date = new Date()): ScoredTask {
    const urgency = this.calcUrgency(task, now);
    const impact = this.calcImpact(task);
    const effort = this.calcEffort(task);
    const dependenciesMet = this.calcDependencies(task);
    const confidence = task.confidenceScore ?? 0.8;

    const score =
      (urgency * WEIGHTS.urgency) +
      (impact * WEIGHTS.impact) +
      (effort * WEIGHTS.effort) +
      (dependenciesMet * WEIGHTS.dependencies) +
      (confidence * WEIGHTS.confidence);

    return {
      task,
      score: Math.round(score * 1000) / 1000,
      breakdown: { urgency, impact, effort, dependenciesMet, confidence },
    };
  }

  scoreAndRank(tasks: Task[], now: Date = new Date()): ScoredTask[] {
    return tasks
      .map(t => this.scoreTask(t, now))
      .sort((a, b) => b.score - a.score);
  }

  getTopTasks(tasks: Task[], cap: number, now: Date = new Date()): { actions: ScoredTask[]; automations: ScoredTask[] } {
    const scored = this.scoreAndRank(tasks, now);
    const actions = scored.filter(s => s.task.type === ('action' as TaskType));
    const automations = scored.filter(s => s.task.type === ('automation' as TaskType));
    return {
      actions: actions.slice(0, cap),
      automations: automations.slice(0, cap * 2),
    };
  }

  private calcUrgency(task: Task, now: Date): number {
    if (!task.dueDate) return 0.5;
    const daysUntilDue = (new Date(task.dueDate).getTime() - now.getTime()) / 86400000;
    if (daysUntilDue <= 0) return 1.0;
    if (daysUntilDue <= 1) return 0.9;
    if (daysUntilDue <= 3) return 0.7;
    if (daysUntilDue <= 7) return 0.5;
    return 0.3;
  }

  private calcImpact(task: Task): number {
    const priority = task.priority ?? 5;
    return Math.max(0, Math.min(1, (10 - priority) / 10));
  }

  private calcEffort(task: Task): number {
    const effort = task.estimatedMinutes ?? 30;
    if (effort <= 5) return 1.0;
    if (effort <= 15) return 0.8;
    if (effort <= 30) return 0.6;
    if (effort <= 60) return 0.4;
    return 0.2;
  }

  private calcDependencies(_task: Task): number {
    return 1.0; // Simplified — all dependencies met for now
  }
}
