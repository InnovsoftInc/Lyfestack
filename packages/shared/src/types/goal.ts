import type { GoalStatus } from '../enums/goal.enums';
import type { TaskType } from '../enums/task.enums';

export type DiagnosticQuestionType = 'select' | 'multiselect' | 'scale' | 'text';

export interface DiagnosticQuestion {
  id: string;
  text: string;
  type: DiagnosticQuestionType;
  options?: string[];
  min?: number;
  max?: number;
  required: boolean;
}

export interface MilestoneTemplate {
  id: string;
  title: string;
  description: string;
  dayOffset: number;
  successCriteria: string[];
}

export interface ActionTemplate {
  id: string;
  title: string;
  description: string;
  type: TaskType;
  frequency?: 'daily' | 'weekly' | 'once';
  durationMinutes?: number;
}

export interface GoalTemplate {
  id: string;
  name: string;
  description: string;
  category: string;
  durationDays: number;
  diagnosticQuestions: DiagnosticQuestion[];
  milestoneTemplates: MilestoneTemplate[];
  suggestedActions: ActionTemplate[];
  /** @deprecated use milestoneTemplates */
  milestones: string[];
  /** @deprecated use suggestedActions */
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
