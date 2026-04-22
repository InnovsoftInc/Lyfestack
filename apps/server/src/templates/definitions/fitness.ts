import { GoalTemplate } from '@lyfestack/shared';

export const fitnessTemplate: GoalTemplate = {
  id: 'tmpl_fitness',
  name: 'Fitness & Health',
  description: 'Build a consistent fitness routine, track your progress, and hit your health goals.',
  category: 'fitness',
  icon: 'heart',
  durationDays: 60,
  diagnosticQuestions: [
    { id: 'q1', question: 'What is your primary fitness goal?', type: 'select', options: ['Lose weight', 'Build muscle', 'Improve endurance', 'Get more flexible', 'General fitness', 'Train for an event'], required: true },
    { id: 'q2', question: 'What is your current fitness level?', type: 'select', options: ['Beginner (rarely exercise)', 'Intermediate (exercise 1-2x/week)', 'Active (exercise 3-4x/week)', 'Advanced (exercise 5+/week)'], required: true },
    { id: 'q3', question: 'What equipment do you have access to?', type: 'multiselect', options: ['Full gym', 'Home weights', 'Resistance bands', 'Pull-up bar', 'Bodyweight only', 'Cardio machine'], required: true },
    { id: 'q4', question: 'How many days per week can you work out?', type: 'select', options: ['2 days', '3 days', '4 days', '5 days', '6+ days'], required: true },
    { id: 'q5', question: 'Do you want nutrition guidance included?', type: 'select', options: ['Yes, full meal planning', 'Yes, general tips', 'No, just workouts'], required: true },
    { id: 'q6', question: 'Any injuries or limitations?', type: 'text', required: false },
  ],
  milestones: ['Baseline measurements taken', 'First week completed', 'Consistent for 2 weeks', 'First progress photo', '30-day check-in', 'Goal achieved or adjusted'],
  defaultTaskTypes: ['workout', 'nutrition', 'tracking', 'rest_day'],
  allowedActions: ['generate_workout', 'log_exercise', 'track_nutrition', 'suggest_meal', 'analyze_progress'],
  automationRules: ['daily_workout_reminder', 'weekly_progress_photo', 'rest_day_suggestions'],
  leadingIndicators: [
    { name: 'Workouts completed', description: 'Sessions completed this week', unit: 'count', targetDirection: 'increase' },
    { name: 'Consistency rate', description: 'Planned vs actual workouts', unit: '%', targetDirection: 'increase' },
    { name: 'Active minutes', description: 'Total active minutes this week', unit: 'minutes', targetDirection: 'increase' },
  ],
};
