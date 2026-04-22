import type { Task } from '@lyfestack/shared';
import { TaskStatus } from '@lyfestack/shared';
import { scoringService } from '../scoring/scoring.service';
import type { BriefUser, StoredBrief } from './daily-loop.types';
import { v4 as uuidv4 } from 'uuid';

function todayDate(): string {
  return new Date().toISOString().slice(0, 10);
}

function buildGreeting(userId: string, date: string): string {
  const hour = new Date().getHours();
  const timeOfDay = hour < 12 ? 'morning' : hour < 17 ? 'afternoon' : 'evening';
  return `Good ${timeOfDay}! Here's your plan for ${date}.`;
}

function buildSummary(tasks: Task[]): string {
  const count = tasks.length;
  if (count === 0) return 'No tasks scheduled — enjoy a recovery day.';
  const types = [...new Set(tasks.map((t) => t.type.toLowerCase()))].join(', ');
  return `You have ${count} task${count > 1 ? 's' : ''} today covering: ${types}.`;
}

function buildInsights(tasks: Task[]): string[] {
  const insights: string[] = [];
  const habits = tasks.filter((t) => t.type === 'HABIT');
  if (habits.length > 0) {
    insights.push(`${habits.length} habit${habits.length > 1 ? 's' : ''} to maintain today.`);
  }
  const milestones = tasks.filter((t) => t.type === 'MILESTONE');
  if (milestones.length > 0) {
    insights.push(`You have a milestone task — prioritize it first.`);
  }
  return insights;
}

export class DailyLoopEngine {
  generateBriefForUser(user: BriefUser, availableTasks: Task[]): StoredBrief {
    const date = todayDate();
    const ranked = scoringService.rankPendingTasks(availableTasks, {
      userId: user.userId,
      engagementVelocity: user.engagementVelocity,
    });

    const tasks = ranked.map((st) => ({
      ...st.task,
      status: st.task.status === TaskStatus.APPROVED ? TaskStatus.IN_PROGRESS : st.task.status,
    }));

    return {
      id: uuidv4(),
      userId: user.userId,
      date,
      greeting: buildGreeting(user.userId, date),
      summary: buildSummary(tasks),
      tasks,
      insights: buildInsights(tasks),
      generatedAt: new Date().toISOString(),
      completedTaskIds: new Set(),
    };
  }
}

export const dailyLoopEngine = new DailyLoopEngine();
