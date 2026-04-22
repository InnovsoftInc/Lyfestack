import type { GoalStatus } from '../enums/goal.enums';

export interface DiagnosticQuestion {
  id: string;
  question: string;
  type: 'text' | 'select' | 'multiselect' | 'number' | 'scale';
  options?: string[];
  required: boolean;
}

export interface LeadingIndicator {
  name: string;
  description: string;
  unit: string;
  targetDirection: 'increase' | 'decrease' | 'maintain';
}

export interface GoalTemplate {
  id: string;
  name: string;
  description: string;
  category: string;
  icon: string;
  durationDays: number;
  diagnosticQuestions: DiagnosticQuestion[];
  milestones: string[];
  defaultTaskTypes: string[];
  allowedActions: string[];
  automationRules: string[];
  leadingIndicators: LeadingIndicator[];
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
  contextLayer?: Record<string, unknown>;
  diagnosticAnswers?: Record<string, unknown>;
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
