import type { FullGoalTemplate } from '../../templates/templates.data';

export interface DiagnosticAnswers {
  [questionId: string]: string | number | string[];
}

export interface UserContext {
  userId: string;
  timezone: string;
  engagementVelocity?: number; // 0-1, derived from task completion history
}

export interface PlannedTask {
  title: string;
  description: string;
  type: 'ACTION' | 'HABIT' | 'MILESTONE' | 'REFLECTION';
  weekNumber: number;
  dayOfWeek?: number; // 0-6, Mon-Sun
  durationMinutes: number;
  isRecurring: boolean;
}

export interface WeeklyTarget {
  weekNumber: number;
  focus: string;
  tasks: PlannedTask[];
  successCriteria: string;
}

export interface GeneratedPlan {
  templateId: string;
  userId: string;
  title: string;
  description: string;
  durationWeeks: number;
  startDate: string;
  targetDate: string;
  milestones: Array<{
    title: string;
    dueDate: string;
    weekNumber: number;
    description: string;
  }>;
  weeklyTargets: WeeklyTarget[];
  initialDailyTasks: PlannedTask[];
}

export interface PlanningStrategy {
  generate(template: FullGoalTemplate, answers: DiagnosticAnswers, context: UserContext): GeneratedPlan;
}
