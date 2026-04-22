import { AgentRole } from '@lyfestack/shared';
import { BaseAgent, AgentInput, AgentOutput } from './BaseAgent';
import { ValidationError } from '../errors/AppError';

const ENCOURAGEMENTS = [
  'Every action compounds. Keep going.',
  'Discipline is choosing your future self over your present comfort.',
  'Progress, not perfection.',
  'The work you do today is the version of you that shows up tomorrow.',
  'Small wins are still wins. Stack them.',
];

const REFLECTION_PROMPTS = [
  'What was the hardest part of this week, and what did it teach you?',
  'What habit, if doubled down on, would accelerate your progress the most?',
  'On a scale of 1-10, how aligned were your actions with your goal this week?',
  'What would you tell a friend who was in exactly your position right now?',
  'What is one thing you are proud of from this week?',
];

function pickDeterministic<T>(arr: T[], seed: string): T {
  const index = seed.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0) % arr.length;
  return arr[index] as T;
}

export class CoachAgent extends BaseAgent {
  readonly role = AgentRole.COACH;
  readonly supportedActions = [
    'SEND_ENCOURAGEMENT',
    'SUGGEST_ADJUSTMENT',
    'CELEBRATE_MILESTONE',
    'PROMPT_REFLECTION',
    'COURSE_CORRECT',
  ];

  process(input: AgentInput): AgentOutput {
    switch (input.action) {
      case 'SEND_ENCOURAGEMENT':
        return this.sendEncouragement(input);
      case 'SUGGEST_ADJUSTMENT':
        return this.suggestAdjustment(input);
      case 'CELEBRATE_MILESTONE':
        return this.celebrateMilestone(input);
      case 'PROMPT_REFLECTION':
        return this.promptReflection(input);
      case 'COURSE_CORRECT':
        return this.courseCorrect(input);
      default:
        throw new ValidationError(`CoachAgent does not support action: ${input.action}`);
    }
  }

  private sendEncouragement(input: AgentInput): AgentOutput {
    const { userId, streak } = input.payload;
    const message = pickDeterministic(ENCOURAGEMENTS, String(userId) + String(streak));
    return this.buildOutput(
      input,
      { message, streakAcknowledged: streak },
      `Encouragement sent to user ${String(userId)}.`,
      [],
    );
  }

  private suggestAdjustment(input: AgentInput): AgentOutput {
    const { goalId, currentScore, issueType } = input.payload;
    const suggestions: Record<string, string> = {
      low_completion: 'Try reducing task count per day by 30% to rebuild momentum.',
      broken_streak: 'Restart with a micro-habit — just 5 minutes — to rebuild the streak.',
      no_progress: 'Revisit your goal title. If it no longer excites you, it may need a reframe.',
      milestone_overdue: 'Break this milestone into two smaller steps with a new target date.',
    };
    const suggestion = suggestions[String(issueType)] ?? 'Review your plan and identify the next smallest action.';

    return this.buildOutput(
      input,
      { goalId, currentScore, suggestion },
      `Adjustment suggested for goal ${String(goalId)}: ${suggestion}`,
      ['REVIEW_WEEK'],
    );
  }

  private celebrateMilestone(input: AgentInput): AgentOutput {
    const { milestoneTitle, goalId, streak } = input.payload;
    return this.buildOutput(
      input,
      {
        milestoneTitle,
        goalId,
        celebration: `You hit "${String(milestoneTitle)}" — this is real progress. On to the next one.`,
        streak,
      },
      `Milestone "${String(milestoneTitle)}" celebrated for goal ${String(goalId)}.`,
      ['PROMPT_REFLECTION', 'SET_NEXT_MILESTONE'],
    );
  }

  private promptReflection(input: AgentInput): AgentOutput {
    const { userId, date } = input.payload;
    const prompt = pickDeterministic(REFLECTION_PROMPTS, String(userId) + String(date));
    return this.buildOutput(
      input,
      { prompt, date },
      `Reflection prompt sent to user ${String(userId)} for ${String(date)}.`,
      [],
    );
  }

  private courseCorrect(input: AgentInput): AgentOutput {
    const { goalId, weeksOffTrack, completionRate } = input.payload;
    const severity = (weeksOffTrack as number) >= 3 ? 'critical' : 'moderate';
    const recommendation =
      severity === 'critical'
        ? 'Consider pausing the goal and replanning with updated constraints.'
        : 'Reduce scope for next 2 weeks and focus on rebuilding consistency.';

    return this.buildOutput(
      input,
      { goalId, severity, recommendation, completionRate },
      `Course correction for goal ${String(goalId)}: ${severity} — ${recommendation}`,
      severity === 'critical' ? ['REPLAN'] : ['SUGGEST_ADJUSTMENT'],
    );
  }
}
