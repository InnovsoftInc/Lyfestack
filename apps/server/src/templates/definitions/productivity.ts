import { GoalTemplate } from '@lyfestack/shared';

export const productivityTemplate: GoalTemplate = {
  id: 'tmpl_productivity',
  name: 'Personal Productivity',
  description: 'Optimize your daily routines, eliminate time wasters, and get more done with less stress.',
  category: 'productivity',
  icon: 'target',
  durationDays: 30,
  diagnosticQuestions: [
    { id: 'q1', question: 'What is your biggest time waster right now?', type: 'text', required: true },
    { id: 'q2', question: 'How many hours per day can you dedicate to focused work?', type: 'number', required: true },
    { id: 'q3', question: 'What tools do you currently use for productivity?', type: 'multiselect', options: ['Notion', 'Todoist', 'Google Calendar', 'Apple Reminders', 'Pen & Paper', 'None'], required: true },
    { id: 'q4', question: 'What time of day are you most productive?', type: 'select', options: ['Early morning (5-8am)', 'Morning (8-12pm)', 'Afternoon (12-5pm)', 'Evening (5-9pm)', 'Night (9pm+)'], required: true },
    { id: 'q5', question: 'Rate your current productivity on a scale of 1-10', type: 'scale', required: true },
    { id: 'q6', question: 'What is the ONE thing you want to accomplish this month?', type: 'text', required: true },
  ],
  milestones: ['Define daily routine', 'Establish morning ritual', 'Eliminate top 3 distractions', 'Build 7-day streak', 'Achieve weekly review habit', 'Complete primary goal'],
  defaultTaskTypes: ['routine_setup', 'focus_block', 'review', 'habit_tracking'],
  allowedActions: ['create_task', 'schedule_focus_block', 'send_reminder', 'generate_review'],
  automationRules: ['auto_schedule_focus_blocks', 'daily_review_prompt', 'streak_tracking'],
  leadingIndicators: [
    { name: 'Focus hours', description: 'Hours of deep work completed', unit: 'hours', targetDirection: 'increase' },
    { name: 'Task completion rate', description: 'Percentage of daily tasks completed', unit: '%', targetDirection: 'increase' },
    { name: 'Distraction incidents', description: 'Times you got sidetracked', unit: 'count', targetDirection: 'decrease' },
  ],
};
