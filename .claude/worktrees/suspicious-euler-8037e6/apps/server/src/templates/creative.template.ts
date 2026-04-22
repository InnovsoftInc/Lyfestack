import { TaskType } from '@lyfestack/shared';
import type { FullGoalTemplate } from './types';

export const creativeTemplate: FullGoalTemplate = {
  id: 'creative-side-project-launch',
  name: 'Launch a Side Project in 60 Days',
  description: 'Go from idea to public launch by shipping a focused side project in 60 days.',
  category: 'creative',
  durationDays: 60,
  tags: ['creative', 'side-project', 'entrepreneurship', 'product', 'build'],
  difficulty: 'advanced',
  estimatedHoursPerWeek: 8,
  milestones: [
    'Concept and scope defined',
    'MVP feature list locked',
    'Working prototype built',
    'Beta testers onboarded',
    'Public launch complete',
  ],
  defaultTaskTypes: [TaskType.HABIT, TaskType.ACTION, TaskType.SOCIAL, TaskType.REFLECTION],
  taskTemplates: [
    {
      title: 'Daily build session',
      description: 'Spend focused time building, designing, or writing for your project',
      type: TaskType.HABIT,
      durationMinutes: 60,
      frequency: 'daily',
    },
    {
      title: 'Weekly demo to a peer',
      description: 'Show your current progress to someone and gather honest feedback',
      type: TaskType.SOCIAL,
      durationMinutes: 30,
      frequency: 'weekly',
    },
    {
      title: 'User feedback session',
      description: 'Run a structured conversation with a potential user to validate your direction',
      type: TaskType.ACTION,
      durationMinutes: 45,
      frequency: 'weekly',
      weekOffset: 2,
    },
    {
      title: 'Iteration sprint planning',
      description: "Review feedback, decide what to build next, and set the week's priorities",
      type: TaskType.ACTION,
      durationMinutes: 30,
      frequency: 'weekly',
    },
    {
      title: 'Builder journal',
      description: 'Write about what you shipped, what you learned, and your next bet',
      type: TaskType.REFLECTION,
      durationMinutes: 15,
      frequency: 'daily',
    },
  ],
  prompt:
    'You are a product and entrepreneurship coach. Help the user scope, build, and launch a focused side project in 60 days. Emphasize shipping over perfection and learning through user feedback.',
};
