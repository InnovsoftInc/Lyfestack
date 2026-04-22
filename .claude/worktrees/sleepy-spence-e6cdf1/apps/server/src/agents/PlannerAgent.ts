import { AgentRole } from '@lyfestack/shared';
import { BaseAgent, AgentInput, AgentOutput } from './BaseAgent';
import { ValidationError } from '../errors/AppError';

export class PlannerAgent extends BaseAgent {
  readonly role = AgentRole.PLANNER;
  readonly supportedActions = ['CREATE_PLAN', 'ADJUST_MILESTONES', 'REPLAN', 'SET_TARGET_DATE'];

  process(input: AgentInput): AgentOutput {
    switch (input.action) {
      case 'CREATE_PLAN':
        return this.createPlan(input);
      case 'ADJUST_MILESTONES':
        return this.adjustMilestones(input);
      case 'REPLAN':
        return this.replan(input);
      case 'SET_TARGET_DATE':
        return this.setTargetDate(input);
      default:
        throw new ValidationError(`PlannerAgent does not support action: ${input.action}`);
    }
  }

  private createPlan(input: AgentInput): AgentOutput {
    const { templateId, goalTitle, startDate } = input.payload;
    return this.buildOutput(
      input,
      { templateId, goalTitle, startDate, status: 'plan_creation_queued' },
      `Creating a 90-day plan for "${String(goalTitle)}" using template ${String(templateId)}.`,
      ['GENERATE_WEEKLY_TASKS', 'SET_FIRST_MILESTONE'],
    );
  }

  private adjustMilestones(input: AgentInput): AgentOutput {
    const { goalId, reason } = input.payload;
    return this.buildOutput(
      input,
      { goalId, reason, adjustment: 'milestones_recalibrated' },
      `Adjusting milestones for goal ${String(goalId)} due to: ${String(reason)}.`,
      ['NOTIFY_USER', 'UPDATE_SCORE'],
    );
  }

  private replan(input: AgentInput): AgentOutput {
    const { goalId, newStartDate } = input.payload;
    return this.buildOutput(
      input,
      { goalId, newStartDate, status: 'replan_queued' },
      `Replanning goal ${String(goalId)} from ${String(newStartDate)}.`,
      ['CREATE_PLAN', 'ARCHIVE_OLD_TASKS'],
    );
  }

  private setTargetDate(input: AgentInput): AgentOutput {
    const { goalId, targetDate } = input.payload;
    return this.buildOutput(
      input,
      { goalId, targetDate },
      `Target date for goal ${String(goalId)} updated to ${String(targetDate)}.`,
      ['ADJUST_MILESTONES'],
    );
  }
}
