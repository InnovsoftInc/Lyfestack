import { plannerAgent } from '../agents/planner.agent';
import { executorAgent } from '../agents/executor.agent';
import { reviewerAgent } from '../agents/reviewer.agent';
import { coachAgent } from '../agents/coach.agent';
import { logger } from '../utils/logger';
import type { Goal, Task } from '@lyfestack/shared';
import type { PlanContext } from './planner';

export const orchestrator = {
  planner: plannerAgent,
  executor: executorAgent,
  reviewer: reviewerAgent,
  coach: coachAgent,

  async runPlannerFlow(context: PlanContext) {
    logger.info({ templateId: context.templateId }, 'Orchestrator: planner flow');
    return plannerAgent.plan(context);
  },

  async runReviewFlow(goal: Goal, tasks: Task[]) {
    logger.info({ goalId: goal.id }, 'Orchestrator: review flow');
    const review = await reviewerAgent.review(goal, tasks);
    const coaching = await coachAgent.motivate({
      goalTitle: goal.title,
      streak: review.scoreResult.streak,
      score: review.scoreResult.score,
    });
    return { review, coaching };
  },
};
