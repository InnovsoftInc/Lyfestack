import type { FullGoalTemplate } from '../../../templates/templates.data';
import type { DiagnosticAnswers, GeneratedPlan, PlannedTask, UserContext } from '../types';
import { BasePlanningStrategy } from './base.strategy';

export class SocialMediaStrategy extends BasePlanningStrategy {
  protected getWeeklyTasks(week: number, _template: FullGoalTemplate, answers: DiagnosticAnswers): PlannedTask[] {
    const freq = String(answers['q_posting_frequency'] ?? '3-5x per week');
    const postsPerWeek = freq.includes('Daily') ? 7 : freq.includes('3-5') ? 4 : freq.includes('1-2') ? 2 : 3;

    const tasks: PlannedTask[] = [
      { title: `Publish ${postsPerWeek} posts`, description: 'Stick to content pillars, batch-create where possible', type: 'HABIT', weekNumber: week, durationMinutes: 30, isRecurring: true },
      { title: 'Engage with 10 accounts', description: 'Genuine replies and comments in your niche', type: 'HABIT', weekNumber: week, durationMinutes: 20, isRecurring: true },
    ];

    if (week % 2 === 0) {
      tasks.push({ title: 'Weekly content analytics review', description: 'Check what performed best — double down', type: 'REFLECTION', weekNumber: week, durationMinutes: 30, isRecurring: false });
    }

    return tasks;
  }

  protected getSuccessCriteria(week: number, _template: FullGoalTemplate): string {
    if (week <= 2) return 'Content pillars defined, first week of posts published';
    if (week <= 5) return 'Posting on schedule, engagement growing';
    if (week <= 8) return 'Follower growth visible week over week';
    return 'Growth target within reach';
  }

  generate(template: FullGoalTemplate, answers: DiagnosticAnswers, context: UserContext): GeneratedPlan {
    const currentFollowers = Number(answers['q_follower_count'] ?? 0);
    const growthGoal = Number(answers['q_growth_goal'] ?? currentFollowers * 3);
    const weeklyGrowthTarget = Math.round((growthGoal - currentFollowers) / template.durationWeeks);

    const focuses = Array.from({ length: template.durationWeeks }, (_, i) => {
      const week = i + 1;
      if (week === 1) return 'Define content pillars and voice';
      if (week === 2) return 'Build content creation system';
      if (week === 3) return 'Consistency — never miss a post';
      return `Grow +${weeklyGrowthTarget} followers`;
    });

    const initialTasks: PlannedTask[] = [
      { title: 'Write content pillars doc', description: '3-5 topics you will post about consistently', type: 'ACTION', weekNumber: 1, durationMinutes: 45, isRecurring: false },
      { title: 'Batch-create first week of content', description: `Create ${Math.max(3, 4)} posts for the week ahead`, type: 'ACTION', weekNumber: 1, durationMinutes: 90, isRecurring: false },
      { title: 'Engage with 10 niche accounts', description: 'Genuine replies — no self-promotion', type: 'HABIT', weekNumber: 1, durationMinutes: 20, isRecurring: true },
    ];

    return this.buildBase(template, context, focuses, initialTasks);
  }
}
