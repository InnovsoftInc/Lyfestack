import type { Task } from '@lyfestack/shared';

export interface ScoringFactors {
  urgency: number;     // 0–1: how soon it needs to be done
  impact: number;      // 0–1: importance to the goal
  effort: number;      // 1–5: higher = more effort (reduces score)
  depsMet: number;     // 0–1: whether dependencies are satisfied
  confidence: number;  // 0–1: user / AI confidence in the task
}

export interface ScoredTask {
  task: Task;
  score: number;
  factors: ScoringFactors;
}

export interface UserScoringContext {
  userId: string;
  engagementVelocity: number; // 0–1, used for adaptive task cap
  taskCap?: number;
}
