import { templateRegistry } from '../templates/TemplateRegistry';

export interface DailyTask {
  title: string;
  type: string;
  durationMinutes: number;
  priority: 'high' | 'medium' | 'low';
}

export interface DailyLoopInput {
  userId: string;
  date: string;
  templateId: string;
  currentStreak: number;
  recentScores: number[];
  pendingMilestoneCount: number;
  completedTasksToday: number;
  plannedTasksToday: DailyTask[];
}

export interface DailyBriefResult {
  userId: string;
  date: string;
  greeting: string;
  summary: string;
  priorityTasks: DailyTask[];
  insights: string[];
  motivationalMessage: string;
  generatedAt: string;
}

const GREETINGS_BY_STREAK: Array<{ minStreak: number; templates: string[] }> = [
  {
    minStreak: 30,
    templates: [
      "You're on a {streak}-day streak — elite consistency.",
      '{streak} days strong. This is who you are now.',
    ],
  },
  {
    minStreak: 14,
    templates: [
      "Two weeks of showing up. That's real.",
      '{streak} days in — the habit is forming. Keep going.',
    ],
  },
  {
    minStreak: 7,
    templates: [
      "One week streak! You've built real momentum.",
      '{streak} days — weekly consistency unlocked.',
    ],
  },
  {
    minStreak: 1,
    templates: [
      "Day {streak} — great to see you back.",
      "You showed up yesterday and today. That's the game.",
    ],
  },
  {
    minStreak: 0,
    templates: [
      "Fresh start today. Every day is day one if you choose it.",
      "Today is a new opportunity. Let's make it count.",
    ],
  },
];

const MOTIVATIONAL_MESSAGES: string[] = [
  'Small consistent actions compound into extraordinary results.',
  "You don't need motivation — you need systems. The system is working.",
  'The difference between who you are and who you want to be is what you do today.',
  'Progress, not perfection. Keep moving.',
  "One task at a time. That's all it takes.",
  'Your future self is watching. Make them proud.',
  'Show up today so tomorrow has a foundation to stand on.',
];

function pickGreeting(streak: number): string {
  const tier = GREETINGS_BY_STREAK.find((t) => streak >= t.minStreak);
  const templates = tier?.templates ?? ["Today's a great day to make progress."];
  const template = templates[Math.floor(Math.random() * templates.length)] ?? templates[0] ?? '';
  return template.replace('{streak}', String(streak));
}

function pickMotivationalMessage(recentScores: number[]): string {
  const avg =
    recentScores.length > 0
      ? recentScores.reduce((a, b) => a + b, 0) / recentScores.length
      : 50;

  if (avg < 50) {
    return 'Progress, not perfection. Keep moving.';
  }
  if (avg >= 85) {
    return "You're performing at a high level — maintain the standards you've set.";
  }
  const idx = Math.floor(Math.random() * MOTIVATIONAL_MESSAGES.length);
  return MOTIVATIONAL_MESSAGES[idx] ?? MOTIVATIONAL_MESSAGES[0] ?? '';
}

function buildSummary(input: DailyLoopInput, templateName: string): string {
  const remaining = input.plannedTasksToday.length - input.completedTasksToday;
  const streakNote =
    input.currentStreak > 0 ? ` You're on a ${input.currentStreak}-day streak.` : '';
  const milestoneNote =
    input.pendingMilestoneCount > 0
      ? ` ${input.pendingMilestoneCount} milestone${input.pendingMilestoneCount > 1 ? 's' : ''} coming up.`
      : '';

  if (remaining <= 0) {
    return `All tasks done for today on your ${templateName} journey.${streakNote}${milestoneNote}`;
  }

  return `${remaining} task${remaining > 1 ? 's' : ''} remaining today on your ${templateName} journey.${streakNote}${milestoneNote}`;
}

function buildInsights(input: DailyLoopInput, avgScore: number): string[] {
  const insights: string[] = [];

  if (avgScore >= 80) {
    insights.push(`Your average score over the last ${input.recentScores.length} sessions is ${Math.round(avgScore)} — well above target.`);
  } else if (avgScore < 60 && input.recentScores.length >= 3) {
    insights.push('Scores have been below 60 recently — consider reducing the number of tasks to build consistency first.');
  }

  const highPriority = input.plannedTasksToday.filter((t) => t.priority === 'high');
  if (highPriority.length > 3) {
    insights.push('You have many high-priority tasks today. Pick the top 3 and protect time for those first.');
  }

  if (input.pendingMilestoneCount > 0) {
    insights.push(`You have ${input.pendingMilestoneCount} upcoming milestone${input.pendingMilestoneCount > 1 ? 's' : ''} — keep milestone-related tasks prioritized.`);
  }

  return insights;
}

export class DailyLoopService {
  generateBrief(input: DailyLoopInput): DailyBriefResult {
    const template = templateRegistry.getById(input.templateId);
    const templateName = template?.name ?? 'your goal';

    const avgScore =
      input.recentScores.length > 0
        ? input.recentScores.reduce((a, b) => a + b, 0) / input.recentScores.length
        : 50;

    const priorityTasks = [...input.plannedTasksToday].sort((a, b) => {
      const order = { high: 0, medium: 1, low: 2 };
      return order[a.priority] - order[b.priority];
    });

    return {
      userId: input.userId,
      date: input.date,
      greeting: pickGreeting(input.currentStreak),
      summary: buildSummary(input, templateName),
      priorityTasks,
      insights: buildInsights(input, avgScore),
      motivationalMessage: pickMotivationalMessage(input.recentScores),
      generatedAt: new Date().toISOString(),
    };
  }
}

export const dailyLoopService = new DailyLoopService();
