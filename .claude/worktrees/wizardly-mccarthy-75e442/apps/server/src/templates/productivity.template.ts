import { TrustTier } from '@lyfestack/shared';
import type { TemplateDefinition } from './types';

export const productivityTemplate: TemplateDefinition = {
  id: 'productivity',
  name: 'Productivity System',
  description:
    'Build a systematic approach to maximizing output, eliminating distractions, and creating sustainable work habits.',
  category: 'productivity',
  durationDays: 90,
  diagnosticQuestions: [
    {
      id: 'main-challenge',
      question: 'What is your biggest productivity challenge right now?',
      type: 'choice',
      options: ['Procrastination', 'Distractions', 'Overwhelm', 'Poor planning', 'Low energy'],
    },
    {
      id: 'deep-work-hours',
      question: 'How many hours of focused, deep work do you currently achieve per day?',
      type: 'scale',
      scaleMin: 0,
      scaleMax: 8,
    },
    {
      id: 'task-system',
      question: 'Do you currently use a task management system?',
      type: 'choice',
      options: ['Yes, consistently', 'Occasionally', 'No'],
    },
    {
      id: 'peak-time',
      question: 'When are you most productive during the day?',
      type: 'choice',
      options: [
        'Early morning (5-8am)',
        'Morning (8-11am)',
        'Afternoon (12-4pm)',
        'Evening (4-8pm)',
        'Night (8pm+)',
      ],
    },
    {
      id: 'primary-goal',
      question: 'What is the main outcome you want from improving your productivity?',
      type: 'text',
    },
  ],
  milestones: [
    {
      id: 'prod-m1',
      title: 'Morning Routine Established',
      description: 'Consistent startup ritual running for 10+ consecutive days',
      weekOffset: 2,
      successCriteria: [
        'Morning routine completed 8 of last 10 days',
        'Daily task list created before 9am each day',
        'Phone-free first hour implemented',
      ],
    },
    {
      id: 'prod-m2',
      title: 'Time Blocking Implemented',
      description: 'Calendar fully structured with protected deep work blocks',
      weekOffset: 4,
      successCriteria: [
        'Deep work blocks scheduled 5 days per week',
        'Recurring meetings batched into specific days',
        'Email/Slack check-in times defined',
      ],
    },
    {
      id: 'prod-m3',
      title: 'Deep Work Mastery',
      description: '4+ hours of focused work achieved daily for 2 consecutive weeks',
      weekOffset: 8,
      successCriteria: [
        'Average 4+ deep work hours per day',
        'Distraction incidents under 3 per session',
        'Weekly review habit established',
      ],
    },
    {
      id: 'prod-m4',
      title: 'Full System Running',
      description: 'Complete productivity system self-sustaining with automated reviews',
      weekOffset: 12,
      successCriteria: [
        'Weekly review completed every week',
        'Monthly planning session done',
        'Productivity score 80+ for 4 consecutive weeks',
        'System documented and shareable',
      ],
    },
  ],
  allowedActions: [
    {
      type: 'schedule_time_block',
      description: 'Add a focused work block to the calendar',
      frequency: 'daily',
    },
    {
      type: 'create_task_list',
      description: 'Generate prioritized daily task list using Eisenhower matrix',
      frequency: 'daily',
    },
    {
      type: 'weekly_review',
      description: 'Conduct structured weekly retrospective',
      frequency: 'weekly',
    },
    {
      type: 'quarterly_planning',
      description: 'Set 90-day goals and decompose into projects',
      frequency: 'monthly',
    },
    {
      type: 'distraction_audit',
      description: 'Identify and eliminate top productivity drains',
      frequency: 'weekly',
    },
  ],
  automationRules: [
    {
      id: 'prod-ar1',
      trigger: 'morning_routine_missed',
      condition: 'Morning routine skipped 3 or more consecutive days',
      action: 'Send motivational check-in and offer to reschedule morning block',
      trustTierRequired: TrustTier.ASSISTED,
    },
    {
      id: 'prod-ar2',
      trigger: 'productivity_score_drop',
      condition: 'Weekly productivity score drops more than 20% from 4-week average',
      action: 'Schedule a diagnostic reflection task and flag for coach review',
      trustTierRequired: TrustTier.ASSISTED,
    },
    {
      id: 'prod-ar3',
      trigger: 'deep_work_target_met',
      condition: 'Deep work hours target met for 5 consecutive days',
      action: 'Celebrate achievement and suggest increasing target by 30 minutes',
      trustTierRequired: TrustTier.AUTONOMOUS,
    },
  ],
  leadingIndicators: [
    {
      id: 'prod-li1',
      metric: 'deep_work_hours',
      description: 'Hours of uninterrupted focused work',
      targetFrequency: 'daily',
      unit: 'hours',
      targetValue: 4,
    },
    {
      id: 'prod-li2',
      metric: 'task_completion_rate',
      description: 'Percentage of planned tasks completed',
      targetFrequency: 'daily',
      unit: 'percent',
      targetValue: 80,
    },
    {
      id: 'prod-li3',
      metric: 'distraction_count',
      description: 'Number of unplanned interruptions per day',
      targetFrequency: 'daily',
      unit: 'incidents',
      targetValue: 5,
    },
    {
      id: 'prod-li4',
      metric: 'weekly_review_done',
      description: 'Whether weekly review was completed',
      targetFrequency: 'weekly',
      unit: 'boolean',
      targetValue: 1,
    },
  ],
  defaultTaskTypes: ['ACTION', 'HABIT', 'REFLECTION'],
};
