import { TrustTier } from '@lyfestack/shared';
import type { TemplateDefinition } from './types';

export const selfImprovementTemplate: TemplateDefinition = {
  id: 'self-improvement',
  name: 'Self Improvement Journey',
  description:
    'Transform yourself through deliberate learning, mindset shifts, and compounding daily habits over 180 days.',
  category: 'personal-development',
  durationDays: 180,
  diagnosticQuestions: [
    {
      id: 'focus-area',
      question: 'Which area do you most want to improve?',
      type: 'choice',
      options: [
        'Mindset & psychology',
        'Skills & knowledge',
        'Relationships',
        'Physical health',
        'Financial habits',
      ],
    },
    {
      id: 'learning-minutes',
      question: 'How many minutes per day do you currently spend on deliberate learning?',
      type: 'scale',
      scaleMin: 0,
      scaleMax: 120,
    },
    {
      id: 'journaling-practice',
      question: 'Do you have a journaling or reflection practice?',
      type: 'choice',
      options: ['Daily', 'A few times a week', 'Occasionally', 'Never'],
    },
    {
      id: 'biggest-obstacle',
      question: 'What is your biggest obstacle to self-improvement right now?',
      type: 'choice',
      options: ['Time', 'Motivation', 'Consistency', 'Clarity on what to work on', 'Lack of accountability'],
    },
    {
      id: 'ideal-self',
      question: 'Describe who you want to become in the next 6 months.',
      type: 'text',
    },
  ],
  milestones: [
    {
      id: 'si-m1',
      title: 'Foundation Habits Set',
      description: 'Core daily habits running consistently for 21 days',
      weekOffset: 3,
      successCriteria: [
        'Morning journaling completed 15 of last 21 days',
        'Daily learning session (30+ min) completed 4+ days per week',
        'Identified top 3 books/courses for next 3 months',
      ],
    },
    {
      id: 'si-m2',
      title: 'First Mindset Shift',
      description: 'Documented evidence of changed beliefs or behaviors in focus area',
      weekOffset: 6,
      successCriteria: [
        'Completed 1 book or course in focus area',
        'Journaled about 3+ specific behavior changes',
        'Established one new empowering habit',
      ],
    },
    {
      id: 'si-m3',
      title: 'Skill Demonstrated',
      description: 'Tangible application of learned skill or knowledge in real life',
      weekOffset: 12,
      successCriteria: [
        'Applied new skill in a real-world situation',
        'Received feedback or measured impact',
        'Completed 2 books or 1 full course in focus area',
      ],
    },
    {
      id: 'si-m4',
      title: 'Mentor or Community Found',
      description: 'Connected with accountability partner or growth community',
      weekOffset: 18,
      successCriteria: [
        'Joined at least one accountability group or community',
        'Met with mentor or coach at least twice',
        'Sharing learnings with others (teaching back)',
      ],
    },
    {
      id: 'si-m5',
      title: 'Transformation Complete',
      description: 'Documented before/after comparison with measurable growth',
      weekOffset: 26,
      successCriteria: [
        'Completed at least 6 books or equivalent courses',
        'Daily learning habit maintained 4+ months',
        'Can articulate specific ways life has improved',
        'New identity fully internalized',
      ],
    },
  ],
  allowedActions: [
    {
      type: 'daily_journal',
      description: 'Guided journaling prompt for reflection and growth',
      frequency: 'daily',
    },
    {
      type: 'learning_session',
      description: 'Structured reading or course study session',
      frequency: 'daily',
    },
    {
      type: 'weekly_retrospective',
      description: 'Review progress and adjust focus areas',
      frequency: 'weekly',
    },
    {
      type: 'book_summary',
      description: 'Capture key insights from completed reading',
      frequency: 'as-needed',
    },
  ],
  automationRules: [
    {
      id: 'si-ar1',
      trigger: 'journaling_streak_broken',
      condition: 'Journaling streak broken after 7+ consecutive days',
      action: 'Send gentle reminder with a tailored reflection prompt',
      trustTierRequired: TrustTier.ASSISTED,
    },
    {
      id: 'si-ar2',
      trigger: 'learning_plateau',
      condition: 'No new book or course started in 14 days',
      action: 'Suggest next resource based on focus area and past completions',
      trustTierRequired: TrustTier.ASSISTED,
    },
    {
      id: 'si-ar3',
      trigger: 'milestone_approaching',
      condition: 'Milestone due in 7 days with success criteria not met',
      action: 'Create focused sprint tasks to meet remaining success criteria',
      trustTierRequired: TrustTier.AUTONOMOUS,
    },
  ],
  leadingIndicators: [
    {
      id: 'si-li1',
      metric: 'learning_minutes',
      description: 'Minutes spent on deliberate learning',
      targetFrequency: 'daily',
      unit: 'minutes',
      targetValue: 45,
    },
    {
      id: 'si-li2',
      metric: 'journal_entries',
      description: 'Days with completed journal entry',
      targetFrequency: 'daily',
      unit: 'boolean',
      targetValue: 1,
    },
    {
      id: 'si-li3',
      metric: 'books_completed',
      description: 'Books or courses completed this month',
      targetFrequency: 'weekly',
      unit: 'count',
    },
    {
      id: 'si-li4',
      metric: 'insight_captures',
      description: 'Key insights captured from learning',
      targetFrequency: 'weekly',
      unit: 'count',
      targetValue: 3,
    },
  ],
  defaultTaskTypes: ['HABIT', 'REFLECTION', 'ACTION'],
};
