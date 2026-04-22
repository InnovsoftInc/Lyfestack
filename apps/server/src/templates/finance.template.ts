import { TaskType } from '@lyfestack/shared';
import type { FullGoalTemplate } from './types';

export const financeTemplate: FullGoalTemplate = {
  id: 'finance-emergency-fund',
  name: 'Build a 6-Month Emergency Fund',
  description:
    'Systematically save 3-6 months of expenses to create financial security and peace of mind.',
  category: 'finance',
  durationDays: 180,
  tags: ['finance', 'saving', 'budgeting', 'emergency-fund'],
  difficulty: 'beginner',
  estimatedHoursPerWeek: 2,
  milestones: [
    'First $500 saved',
    '$1,000 milestone reached',
    'Halfway to goal',
    '75% funded',
    'Emergency fund complete',
  ],
  defaultTaskTypes: [TaskType.HABIT, TaskType.ACTION, TaskType.REFLECTION],
  taskTemplates: [
    {
      title: 'Log daily expenses',
      description: 'Record all spending for the day in your budgeting tool',
      type: TaskType.HABIT,
      durationMinutes: 5,
      frequency: 'daily',
    },
    {
      title: 'Weekly savings transfer',
      description: 'Move your scheduled savings contribution to your emergency fund account',
      type: TaskType.ACTION,
      durationMinutes: 5,
      frequency: 'weekly',
    },
    {
      title: 'Monthly budget review',
      description: 'Review spending categories and identify areas to cut back',
      type: TaskType.ACTION,
      durationMinutes: 30,
      frequency: 'monthly',
    },
    {
      title: 'Subscription audit',
      description: 'Review and cancel unused subscriptions to free up savings capacity',
      type: TaskType.ACTION,
      durationMinutes: 20,
      frequency: 'once',
      weekOffset: 0,
    },
    {
      title: 'Financial check-in',
      description: 'Reflect on your money mindset and progress toward financial security',
      type: TaskType.REFLECTION,
      durationMinutes: 15,
      frequency: 'weekly',
    },
  ],
  prompt:
    'You are a personal finance coach. Help the user build an emergency fund by creating a realistic savings plan based on their income and current expenses.',
};
