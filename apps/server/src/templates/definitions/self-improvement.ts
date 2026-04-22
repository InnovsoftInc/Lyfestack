import { GoalTemplate } from '@lyfestack/shared';

export const selfImprovementTemplate: GoalTemplate = {
  id: 'tmpl_self_improvement',
  name: 'Self Improvement',
  description: 'Build better habits, grow personally, and become the best version of yourself.',
  category: 'self-improvement',
  icon: 'trending-up',
  durationDays: 60,
  diagnosticQuestions: [
    { id: 'q1', question: 'What area of your life do you most want to improve?', type: 'select', options: ['Mental health', 'Relationships', 'Career growth', 'Financial literacy', 'Spiritual growth', 'Education'], required: true },
    { id: 'q2', question: 'Do you currently have a journaling or reflection practice?', type: 'select', options: ['Daily', 'Weekly', 'Occasionally', 'Never'], required: true },
    { id: 'q3', question: 'How many books have you read in the last 6 months?', type: 'number', required: true },
    { id: 'q4', question: 'What habits do you want to build?', type: 'multiselect', options: ['Reading', 'Meditation', 'Journaling', 'Exercise', 'Learning a skill', 'Better sleep'], required: true },
    { id: 'q5', question: 'What is holding you back from growing?', type: 'text', required: true },
    { id: 'q6', question: 'How much time per day can you invest in self-improvement?', type: 'select', options: ['15 minutes', '30 minutes', '1 hour', '2+ hours'], required: true },
  ],
  milestones: ['Define growth areas', 'Start daily habit', 'Complete first book/course', '14-day streak', 'First weekly reflection', 'Measurable progress checkpoint'],
  defaultTaskTypes: ['habit_practice', 'reading', 'reflection', 'learning'],
  allowedActions: ['create_habit', 'suggest_reading', 'generate_reflection_prompt', 'track_progress'],
  automationRules: ['daily_habit_reminder', 'weekly_reflection_prompt', 'reading_suggestions'],
  leadingIndicators: [
    { name: 'Habit streak', description: 'Consecutive days completing habits', unit: 'days', targetDirection: 'increase' },
    { name: 'Reflection entries', description: 'Journal entries completed', unit: 'count', targetDirection: 'increase' },
    { name: 'Learning hours', description: 'Time spent on growth activities', unit: 'hours', targetDirection: 'increase' },
  ],
};
