import { TaskType } from '@lyfestack/shared';
import type { FullGoalTemplate } from './types';

export const careerTemplate: FullGoalTemplate = {
  id: 'career-job-search-60-day',
  name: '60-Day Job Search Sprint',
  description:
    'Land your target role in 60 days through disciplined outreach, interview prep, and strategic networking.',
  category: 'career',
  durationDays: 60,
  tags: ['career', 'job-search', 'networking', 'interviews'],
  difficulty: 'intermediate',
  estimatedHoursPerWeek: 10,
  milestones: [
    'Resume and LinkedIn polished',
    '10 applications submitted',
    'First interview booked',
    'Second-round interview reached',
    'Offer received',
  ],
  defaultTaskTypes: [TaskType.HABIT, TaskType.ACTION, TaskType.SOCIAL, TaskType.REFLECTION],
  taskTemplates: [
    {
      title: 'Submit job applications',
      description: 'Apply to at least 2 positions that match your target role and company criteria',
      type: TaskType.HABIT,
      durationMinutes: 45,
      frequency: 'daily',
    },
    {
      title: 'Networking outreach',
      description:
        'Reach out to 1-2 people in your target companies or roles for informational chats',
      type: TaskType.SOCIAL,
      durationMinutes: 30,
      frequency: 'daily',
    },
    {
      title: 'Interview prep session',
      description: 'Practice behavioral or technical interview questions for your target role',
      type: TaskType.ACTION,
      durationMinutes: 45,
      frequency: 'daily',
    },
    {
      title: 'Tailor resume for role',
      description: 'Customize your resume and cover letter for a specific application',
      type: TaskType.ACTION,
      durationMinutes: 30,
      frequency: 'daily',
    },
    {
      title: 'Weekly pipeline review',
      description: 'Review all active applications, follow up where needed, and adjust strategy',
      type: TaskType.REFLECTION,
      durationMinutes: 30,
      frequency: 'weekly',
    },
  ],
  prompt:
    'You are a career coach. Help the user run a focused 60-day job search by creating a daily outreach and interview prep plan tailored to their target industry and role level.',
};
