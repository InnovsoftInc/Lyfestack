import type { Task } from '@lyfestack/shared';

export interface ScoringFactors {
  urgency: number;       // 0-1: how time-sensitive is this task
  impact: number;        // 0-1: how much does it move the needle on the goal
  effort: number;        // 0-1: how much effort is required (higher = more effort)
  dependenciesMet: number; // 0-1: are blockers cleared (1 = fully unblocked)
  confidence: number;    // 0-1: user confidence in completing this task
}

export interface ScoredTask {
  task: Task;
  score: number;         // final composite score 0-1
  factors: ScoringFactors;
  rank: number;
  isAutomation: boolean; // true if the system executed this, not the user
}

export interface ScoringContext {
  userId: string;
  engagementVelocity: number; // 0-1, derived from recent completion history
  taskCap: number;            // max tasks to surface today
}
