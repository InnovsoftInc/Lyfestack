import type { GoalTemplate } from '@lyfestack/shared';
import type { TaskType } from '@lyfestack/shared';

export interface TaskTemplate {
  title: string;
  description: string;
  type: TaskType;
  durationMinutes?: number;
  frequency: 'daily' | 'weekly' | 'monthly' | 'once';
  weekOffset?: number;
}

export interface FullGoalTemplate extends GoalTemplate {
  tags: string[];
  estimatedHoursPerWeek: number;
  difficulty: 'beginner' | 'intermediate' | 'advanced';
  taskTemplates: TaskTemplate[];
  prompt: string;
}
