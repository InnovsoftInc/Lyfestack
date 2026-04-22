import { TrustTier } from '@lyfestack/shared';
import type { TemplateDefinition } from './types';

export const fitnessTemplate: TemplateDefinition = {
  id: 'fitness',
  name: 'Fitness Transformation',
  description:
    'Build lasting fitness through progressive training, smart nutrition, and recovery optimization over 90 days.',
  category: 'health',
  durationDays: 90,
  diagnosticQuestions: [
    {
      id: 'fitness-goal',
      question: 'What is your primary fitness goal?',
      type: 'choice',
      options: [
        'Lose body fat',
        'Build muscle',
        'Improve endurance',
        'Increase strength',
        'General fitness & energy',
      ],
    },
    {
      id: 'current-activity',
      question: 'How many days per week do you currently exercise?',
      type: 'scale',
      scaleMin: 0,
      scaleMax: 7,
    },
    {
      id: 'training-history',
      question: 'How would you describe your training experience?',
      type: 'choice',
      options: [
        'Complete beginner',
        'Exercised before but inconsistent',
        'Consistent 1-2 years',
        'Trained seriously 3+ years',
        'Competitive athlete',
      ],
    },
    {
      id: 'obstacles',
      question: 'What has stopped you from reaching your fitness goals before?',
      type: 'choice',
      options: ['Lack of consistency', 'No clear program', 'Injuries', 'Nutrition', 'Time', 'Motivation'],
    },
    {
      id: 'specific-goal',
      question: 'What specific physical result do you want to achieve in 90 days?',
      type: 'text',
    },
  ],
  milestones: [
    {
      id: 'fit-m1',
      title: 'Training Habit Locked In',
      description: 'Workout routine completed consistently for 3 consecutive weeks',
      weekOffset: 3,
      successCriteria: [
        'Completed planned workouts 3 weeks in a row',
        'Baseline measurements and photos taken',
        'Nutrition tracking started (even if imperfect)',
      ],
    },
    {
      id: 'fit-m2',
      title: 'Strength Progression Documented',
      description: 'Measurable improvement in key lifts or cardio metrics',
      weekOffset: 6,
      successCriteria: [
        'Main lifts increased by at least 5-10%',
        'Cardio performance improved (time, distance, or heart rate)',
        'Recovery protocol (sleep + mobility) established',
      ],
    },
    {
      id: 'fit-m3',
      title: 'Body Composition Changing',
      description: 'Visible or measurable change in body composition',
      weekOffset: 9,
      successCriteria: [
        'Measurable change in weight, measurements, or body fat %',
        'Before/after progress photo comparison positive',
        'Nutrition adherence averaging 80%+ per week',
      ],
    },
    {
      id: 'fit-m4',
      title: 'Transformation Complete',
      description: '90-day goal achieved with sustainable habits in place',
      weekOffset: 13,
      successCriteria: [
        'Primary fitness goal achieved or on track',
        "Training habit is now automatic (doesn't require willpower)",
        'Plan created for next 90-day phase',
        'Documented results and lessons learned',
      ],
    },
  ],
  allowedActions: [
    {
      type: 'log_workout',
      description: 'Record completed workout with sets, reps, and weights',
      frequency: 'daily',
    },
    {
      type: 'log_nutrition',
      description: 'Track meals and macros for the day',
      frequency: 'daily',
    },
    {
      type: 'progress_check_in',
      description: 'Review weekly measurements, photos, and performance data',
      frequency: 'weekly',
    },
    {
      type: 'program_adjustment',
      description: 'Adjust training program based on recovery and progress',
      frequency: 'weekly',
    },
    {
      type: 'recovery_session',
      description: 'Scheduled mobility, stretching, or deload workout',
      frequency: 'as-needed',
    },
  ],
  automationRules: [
    {
      id: 'fit-ar1',
      trigger: 'workout_missed',
      condition: 'Two or more planned workouts missed in a week',
      action: 'Suggest modified schedule and send recovery or light workout option',
      trustTierRequired: TrustTier.ASSISTED,
    },
    {
      id: 'fit-ar2',
      trigger: 'plateau_detected',
      condition: 'No progress on key metrics for 2+ consecutive weeks',
      action: 'Flag potential plateau and suggest deload week followed by program variation',
      trustTierRequired: TrustTier.ASSISTED,
    },
    {
      id: 'fit-ar3',
      trigger: 'consistent_training_week',
      condition: 'All planned workouts completed for 4 consecutive weeks',
      action: 'Acknowledge consistency and suggest progressive overload increase',
      trustTierRequired: TrustTier.AUTONOMOUS,
    },
  ],
  leadingIndicators: [
    {
      id: 'fit-li1',
      metric: 'workouts_completed',
      description: 'Workouts completed vs planned per week',
      targetFrequency: 'weekly',
      unit: 'sessions',
      targetValue: 4,
    },
    {
      id: 'fit-li2',
      metric: 'nutrition_adherence',
      description: 'Days with nutrition on-target',
      targetFrequency: 'daily',
      unit: 'boolean',
      targetValue: 1,
    },
    {
      id: 'fit-li3',
      metric: 'daily_steps',
      description: 'Total steps taken per day',
      targetFrequency: 'daily',
      unit: 'steps',
      targetValue: 8000,
    },
    {
      id: 'fit-li4',
      metric: 'sleep_hours',
      description: 'Hours of sleep per night',
      targetFrequency: 'daily',
      unit: 'hours',
      targetValue: 8,
    },
    {
      id: 'fit-li5',
      metric: 'strength_progression',
      description: 'Weekly improvement in primary lift',
      targetFrequency: 'weekly',
      unit: 'percent',
    },
  ],
  defaultTaskTypes: ['HABIT', 'ACTION', 'MILESTONE'],
};
