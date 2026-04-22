import { TaskType } from '@lyfestack/shared';
import type { FullGoalTemplate } from './types';

export const fitnessTemplate: FullGoalTemplate = {
  id: 'fitness-90-day-transformation',
  name: '90-Day Body Transformation',
  description: 'Build strength, improve cardio, and create lasting healthy habits over 90 days.',
  category: 'fitness',
  durationDays: 90,
  tags: ['fitness', 'health', 'workout', 'nutrition'],
  difficulty: 'intermediate',
  estimatedHoursPerWeek: 5,
  milestones: [
    'Complete first workout',
    'Maintain 2-week streak',
    '30-day check-in: measure progress',
    '60-day milestone: increase intensity',
    '90-day transformation complete',
  ],
  defaultTaskTypes: [TaskType.HABIT, TaskType.ACTION, TaskType.REFLECTION],
  taskTemplates: [
    {
      title: 'Morning workout',
      description: 'Complete your scheduled workout for the day',
      type: TaskType.HABIT,
      durationMinutes: 45,
      frequency: 'daily',
    },
    {
      title: 'Log nutrition',
      description: 'Track your meals and macros for the day',
      type: TaskType.HABIT,
      durationMinutes: 10,
      frequency: 'daily',
    },
    {
      title: 'Weekly weigh-in',
      description: 'Record your weight and key measurements',
      type: TaskType.ACTION,
      durationMinutes: 5,
      frequency: 'weekly',
    },
    {
      title: 'Progress photo',
      description: 'Take front, side, and back progress photos',
      type: TaskType.ACTION,
      durationMinutes: 5,
      frequency: 'weekly',
      weekOffset: 0,
    },
    {
      title: 'Weekly reflection',
      description: 'Journal about your energy levels, challenges, and wins this week',
      type: TaskType.REFLECTION,
      durationMinutes: 15,
      frequency: 'weekly',
    },
  ],
  prompt:
    'You are a personal fitness coach. Generate a balanced weekly workout plan that progressively increases in difficulty over 90 days, mixing strength training and cardio.',
};
