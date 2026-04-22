import type { GoalStatus } from '../enums/goal.enums';

export interface GoalTemplate {
  id: string;
  name: string;
  description: string;
  category: string;
  durationDays: number;
  milestones: string[];
  defaultTaskTypes: string[];
}

export interface Goal {
  id: string;
  userId: string;
  templateId?: string;
  title: string;
  description: string;
  status: GoalStatus;
  targetDate?: string;
  progressScore: number;
  milestones: GoalMilestone[];
  createdAt: string;
  updatedAt: string;
}

export interface GoalMilestone {
  id: string;
  goalId: string;
  title: string;
  dueDate?: string;
  completedAt?: string;
}
