import { GoalTemplate } from '@lyfestack/shared';

export interface PlanOutput {
  milestones: { title: string; targetDate: string; weekNumber: number }[];
  weeklyTargets: { week: number; focus: string; tasks: string[] }[];
  initialTasks: { title: string; type: string; priority: number; description: string }[];
}

export interface PlanningStrategy {
  generatePlan(template: GoalTemplate, answers: Record<string, unknown>, startDate: Date): PlanOutput;
}

export class DefaultPlanningStrategy implements PlanningStrategy {
  generatePlan(template: GoalTemplate, _answers: Record<string, unknown>, startDate: Date): PlanOutput {
    const weeks = Math.ceil(template.durationDays / 7);
    const milestones = template.milestones.map((title, i) => ({
      title,
      targetDate: new Date(startDate.getTime() + ((i + 1) * (template.durationDays / template.milestones.length)) * 86400000).toISOString().split('T')[0] as string,
      weekNumber: Math.ceil(((i + 1) / template.milestones.length) * weeks),
    }));

    const weeklyTargets = Array.from({ length: Math.min(weeks, 4) }, (_, i) => ({
      week: i + 1,
      focus: milestones[Math.min(i, milestones.length - 1)]?.title ?? 'Continue progress',
      tasks: template.defaultTaskTypes.map(type => `${type}_week_${i + 1}`),
    }));

    const initialTasks = template.defaultTaskTypes.slice(0, 3).map((type, i) => ({
      title: `Complete ${type.replace(/_/g, ' ')} setup`,
      type,
      priority: i + 1,
      description: `Initial ${type.replace(/_/g, ' ')} task for ${template.name}`,
    }));

    return { milestones, weeklyTargets, initialTasks };
  }
}

export class BusinessPlanningStrategy implements PlanningStrategy {
  generatePlan(template: GoalTemplate, answers: Record<string, unknown>, startDate: Date): PlanOutput {
    const base = new DefaultPlanningStrategy().generatePlan(template, answers, startDate);
    const bottleneck = answers['q3'] as string ?? 'Getting customers';
    
    base.initialTasks.unshift({
      title: `Address primary bottleneck: ${bottleneck}`,
      type: 'strategy',
      priority: 0,
      description: `Your biggest challenge is "${bottleneck}". This task focuses on creating a plan to address it.`,
    });

    return base;
  }
}

export class FitnessPlanningStrategy implements PlanningStrategy {
  generatePlan(template: GoalTemplate, answers: Record<string, unknown>, startDate: Date): PlanOutput {
    const base = new DefaultPlanningStrategy().generatePlan(template, answers, startDate);
    const workoutDays = parseInt(String(answers['q4'] ?? '3').replace(/\D/g, '')) || 3;

    base.initialTasks.unshift({
      title: `Set up ${workoutDays}-day workout schedule`,
      type: 'workout',
      priority: 0,
      description: `Create a ${workoutDays}-day per week workout plan based on your equipment and goals.`,
    });

    return base;
  }
}

export function getStrategyForCategory(category: string): PlanningStrategy {
  switch (category) {
    case 'business': return new BusinessPlanningStrategy();
    case 'fitness': return new FitnessPlanningStrategy();
    default: return new DefaultPlanningStrategy();
  }
}
