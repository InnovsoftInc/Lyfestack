import { AgentRole } from '@lyfestack/shared';
import { BaseAgent, AgentInput, AgentOutput } from './BaseAgent';
import { ValidationError } from '../errors/AppError';

export class ExecutorAgent extends BaseAgent {
  readonly role = AgentRole.EXECUTOR;
  readonly supportedActions = [
    'SCHEDULE_TASK',
    'RESCHEDULE_TASK',
    'COMPLETE_TASK',
    'SKIP_TASK',
    'DELEGATE_TASK',
    'BATCH_SCHEDULE',
  ];

  process(input: AgentInput): AgentOutput {
    switch (input.action) {
      case 'SCHEDULE_TASK':
        return this.scheduleTask(input);
      case 'RESCHEDULE_TASK':
        return this.rescheduleTask(input);
      case 'COMPLETE_TASK':
        return this.completeTask(input);
      case 'SKIP_TASK':
        return this.skipTask(input);
      case 'DELEGATE_TASK':
        return this.delegateTask(input);
      case 'BATCH_SCHEDULE':
        return this.batchSchedule(input);
      default:
        throw new ValidationError(`ExecutorAgent does not support action: ${input.action}`);
    }
  }

  private scheduleTask(input: AgentInput): AgentOutput {
    const { taskId, scheduledFor } = input.payload;
    return this.buildOutput(
      input,
      { taskId, scheduledFor, status: 'scheduled' },
      `Task ${String(taskId)} scheduled for ${String(scheduledFor)}.`,
      ['NOTIFY_USER'],
    );
  }

  private rescheduleTask(input: AgentInput): AgentOutput {
    const { taskId, newDate, reason } = input.payload;
    return this.buildOutput(
      input,
      { taskId, newDate, reason },
      `Rescheduling task ${String(taskId)} to ${String(newDate)}: ${String(reason)}.`,
      ['UPDATE_STREAK'],
    );
  }

  private completeTask(input: AgentInput): AgentOutput {
    const { taskId, completedAt, durationMinutes } = input.payload;
    return this.buildOutput(
      input,
      { taskId, completedAt, durationMinutes, status: 'completed' },
      `Task ${String(taskId)} marked complete at ${String(completedAt)}.`,
      ['UPDATE_SCORE', 'UPDATE_STREAK', 'CHECK_MILESTONE'],
    );
  }

  private skipTask(input: AgentInput): AgentOutput {
    const { taskId, reason } = input.payload;
    return this.buildOutput(
      input,
      { taskId, reason, status: 'skipped' },
      `Task ${String(taskId)} skipped: ${String(reason)}.`,
      ['UPDATE_STREAK', 'SUGGEST_RECOVERY'],
    );
  }

  private delegateTask(input: AgentInput): AgentOutput {
    const { taskId, delegateTo } = input.payload;
    return this.buildOutput(
      input,
      { taskId, delegateTo, status: 'delegated' },
      `Task ${String(taskId)} delegated to ${String(delegateTo)}.`,
      [],
    );
  }

  private batchSchedule(input: AgentInput): AgentOutput {
    const { taskIds, weekStartDate } = input.payload;
    const ids = Array.isArray(taskIds) ? taskIds : [];
    return this.buildOutput(
      input,
      { taskIds: ids, weekStartDate, status: 'batch_scheduled', count: ids.length },
      `Batch scheduled ${ids.length} tasks for week of ${String(weekStartDate)}.`,
      ['GENERATE_DAILY_BRIEF'],
    );
  }
}
