/**
 * Task scoring: final_score = (urgency * impact * confidence) / log(effort + 1) * dependency_multiplier
 *
 * All raw inputs are clamped to their valid range before scoring. Output is normalized 0–100.
 */

export interface ScoringInput {
  taskId: string;
  /** ISO date string — how soon it must be done */
  dueDate?: string;
  /** 1–10: how much progress this moves on the parent goal */
  impact: number;
  /** 1–10: estimated effort (1 = trivial, 10 = enormous) */
  effort: number;
  /** Number of unresolved blocking tasks */
  blockedByCount: number;
  /** Number of tasks this task unlocks */
  unlocksCount: number;
  /** 0–1: how certain we are this is the right action right now */
  confidence: number;
}

export interface TaskScoreBreakdown {
  urgency: number;
  impact: number;
  effort: number;
  dependencyMultiplier: number;
  confidence: number;
  rawScore: number;
}

export interface TaskScore {
  taskId: string;
  score: number;
  breakdown: TaskScoreBreakdown;
}

const URGENCY_HORIZON_DAYS = 14;

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

function computeUrgency(dueDate?: string): number {
  if (!dueDate) return 5;
  const now = Date.now();
  const due = new Date(dueDate).getTime();
  const daysRemaining = (due - now) / (1000 * 60 * 60 * 24);

  if (daysRemaining <= 0) return 10;
  if (daysRemaining >= URGENCY_HORIZON_DAYS) return 1;

  // Linear scale: 14+ days → 1, 0 days → 10
  return clamp(10 - (daysRemaining / URGENCY_HORIZON_DAYS) * 9, 1, 10);
}

function computeDependencyMultiplier(blockedByCount: number, unlocksCount: number): number {
  if (blockedByCount > 0) {
    // Penalise blocked tasks — can't act on them yet
    return Math.max(0.3, 0.7 - blockedByCount * 0.1);
  }
  // Reward tasks that unblock others
  return Math.min(1.5, 1.0 + unlocksCount * 0.1);
}

function computeRawScore(
  urgency: number,
  impact: number,
  effort: number,
  dependencyMultiplier: number,
  confidence: number,
): number {
  // Higher effort → lower denominator value (log compresses the penalty)
  const effortDivisor = Math.log(effort + 1);
  return (urgency * impact * confidence * dependencyMultiplier) / effortDivisor;
}

export function scoreTask(input: ScoringInput): TaskScore {
  const urgency = computeUrgency(input.dueDate);
  const impact = clamp(input.impact, 1, 10);
  const effort = clamp(input.effort, 1, 10);
  const confidence = clamp(input.confidence, 0, 1);
  const dependencyMultiplier = computeDependencyMultiplier(input.blockedByCount, input.unlocksCount);
  const rawScore = computeRawScore(urgency, impact, effort, dependencyMultiplier, confidence);

  return {
    taskId: input.taskId,
    score: rawScore,
    breakdown: { urgency, impact, effort, dependencyMultiplier, confidence, rawScore },
  };
}

export function rankTasks(inputs: ScoringInput[]): TaskScore[] {
  const scored = inputs.map(scoreTask);
  const max = Math.max(...scored.map((s) => s.breakdown.rawScore), 1);

  // Normalise to 0–100
  const normalised = scored.map((s) => ({
    ...s,
    score: Math.round((s.breakdown.rawScore / max) * 100),
  }));

  return normalised.sort((a, b) => b.score - a.score);
}

export function topN(inputs: ScoringInput[], n: number): TaskScore[] {
  return rankTasks(inputs).slice(0, n);
}
