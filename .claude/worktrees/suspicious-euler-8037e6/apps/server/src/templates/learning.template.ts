import { TaskType } from '@lyfestack/shared';
import type { FullGoalTemplate } from './types';

export const learningTemplate: FullGoalTemplate = {
  id: 'learning-30-day-skill-sprint',
  name: '30-Day Skill Sprint',
  description:
    'Master a new skill in 30 days through daily practice, structured learning, and accountability.',
  category: 'learning',
  durationDays: 30,
  tags: ['learning', 'skill', 'growth', 'education'],
  difficulty: 'beginner',
  estimatedHoursPerWeek: 7,
  milestones: [
    'Complete first learning session',
    'Week 1: fundamentals solid',
    'Midpoint practice project started',
    'Week 3: skill assessment completed',
    'Final project delivered',
  ],
  defaultTaskTypes: [TaskType.HABIT, TaskType.ACTION, TaskType.REFLECTION, TaskType.SOCIAL],
  taskTemplates: [
    {
      title: 'Daily study session',
      description: 'Complete your scheduled lesson or practice for today',
      type: TaskType.HABIT,
      durationMinutes: 60,
      frequency: 'daily',
    },
    {
      title: 'Practice exercise',
      description: 'Apply what you learned through a hands-on exercise or drill',
      type: TaskType.HABIT,
      durationMinutes: 30,
      frequency: 'daily',
    },
    {
      title: 'Weekly reflection',
      description: 'Document what clicked, what was hard, and your key learnings this week',
      type: TaskType.REFLECTION,
      durationMinutes: 20,
      frequency: 'weekly',
    },
    {
      title: 'Share progress with accountability partner',
      description: 'Post an update or demo your progress to someone who can keep you on track',
      type: TaskType.SOCIAL,
      durationMinutes: 15,
      frequency: 'weekly',
    },
    {
      title: 'Build a mini project',
      description: 'Apply your skills to a small real-world project to reinforce learning',
      type: TaskType.ACTION,
      durationMinutes: 120,
      frequency: 'weekly',
      weekOffset: 1,
    },
  ],
  prompt:
    'You are a learning coach. Create a structured 30-day curriculum that builds skills progressively, balancing theory with practice and ensuring the learner applies what they learn.',
};
