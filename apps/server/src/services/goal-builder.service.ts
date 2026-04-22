import { v4 as uuidv4 } from 'uuid';
import { OpenClawService } from '../integrations/openclaw/openclaw.service';
import type { GoalService } from './goal.service';
import { logger } from '../utils/logger';

export interface AIQuestion {
  question: string;
  inputType: 'text' | 'scale' | 'choice' | 'boolean';
  options?: string[];
  placeholder?: string;
  context?: string;
  isLastQuestion?: boolean;
}

export interface AIPlanMilestone {
  title: string;
  week: number;
  description: string;
}

export interface AIPlanTask {
  title: string;
  description: string;
  type: string;
  priority: string;
  estimatedMinutes: number;
}

export interface AIPlan {
  title: string;
  summary: string;
  milestones: AIPlanMilestone[];
  tasks: AIPlanTask[];
  timeline: { durationDays: number; startDate: string };
}

export interface SessionTaskModification {
  editedMilestones?: { index: number; title: string }[];
  removedTaskIndices?: number[];
  addedTasks?: { title: string; description: string }[];
  timelineOverride?: { durationDays: number };
}

interface ConversationAnswer {
  question: string;
  answer: string;
}

interface GoalBuilderSession {
  id: string;
  userId: string;
  templateId: string;
  templateName: string;
  answers: ConversationAnswer[];
  currentQuestion: AIQuestion | null;
  status: 'asking' | 'ready' | 'approved';
  generatedPlan: AIPlan | null;
}

// In-memory session store — sessions survive for the lifetime of the process
const sessions = new Map<string, GoalBuilderSession>();

const AI_AGENT = 'main';

export class GoalBuilderService {
  constructor(
    private readonly openClaw: OpenClawService,
    private readonly goalService: GoalService,
  ) {}

  async startSession(
    userId: string,
    templateId: string,
    templateName: string,
  ): Promise<{ sessionId: string; question: AIQuestion }> {
    const sessionId = uuidv4();
    const session: GoalBuilderSession = {
      id: sessionId,
      userId,
      templateId,
      templateName,
      answers: [],
      currentQuestion: null,
      status: 'asking',
      generatedPlan: null,
    };
    sessions.set(sessionId, session);

    const prompt =
      `You are a goal planning assistant. You are helping a user set up a "${templateName}" goal. ` +
      `Ask the FIRST question to understand their situation better. ` +
      `Return ONLY valid JSON with no other text: ` +
      `{"question":"...","inputType":"text|scale|choice|boolean","options":["..."],"placeholder":"...","context":"...","isLastQuestion":false}. ` +
      `"options" is only required when inputType is "choice". ` +
      `When you have enough context (after 5-10 questions), set isLastQuestion:true.`;

    const raw = await this.openClaw.sendMessage(AI_AGENT, prompt);
    const question = parseQuestion(raw);
    session.currentQuestion = question;

    return { sessionId, question };
  }

  async answerQuestion(
    sessionId: string,
    answer: string,
  ): Promise<{ question?: AIQuestion; plan?: AIPlan; done: boolean }> {
    const session = sessions.get(sessionId);
    if (!session) throw new Error(`Session ${sessionId} not found`);
    if (session.status !== 'asking') throw new Error(`Session is not in asking state`);

    if (session.currentQuestion) {
      session.answers.push({ question: session.currentQuestion.question, answer });
    }

    if (session.currentQuestion?.isLastQuestion) {
      const plan = await this._generatePlan(session);
      session.generatedPlan = plan;
      session.status = 'ready';
      return { plan, done: true };
    }

    const historyLines = session.answers
      .map((a, i) => `Q${i + 1}: ${a.question}\nA${i + 1}: ${a.answer}`)
      .join('\n\n');

    const prompt =
      `You are a goal planning assistant helping a user set up a "${session.templateName}" goal.\n\n` +
      `Previous answers:\n${historyLines}\n\n` +
      `Based on these answers, ask the NEXT question. ` +
      `Return ONLY valid JSON: ` +
      `{"question":"...","inputType":"text|scale|choice|boolean","options":["..."],"placeholder":"...","context":"...","isLastQuestion":false}. ` +
      `"options" is only required when inputType is "choice". ` +
      `When you have enough context (after 5-10 questions total), set isLastQuestion:true.`;

    const raw = await this.openClaw.sendMessage(AI_AGENT, prompt);
    const question = parseQuestion(raw);
    session.currentQuestion = question;

    return { question, done: false };
  }

  async approveSession(
    sessionId: string,
    modifications?: SessionTaskModification,
  ): Promise<{ goalId: string }> {
    const session = sessions.get(sessionId);
    if (!session) throw new Error(`Session ${sessionId} not found`);

    const diagnosticAnswers = session.answers.map((a, i) => ({
      questionId: `q-${i}`,
      value: a.answer,
    }));

    const goal = await this.goalService.createGoal({
      userId: session.userId,
      title: session.generatedPlan?.title ?? session.templateName,
      description: session.generatedPlan?.summary ?? '',
      templateId: session.templateId,
      diagnosticAnswers,
    });

    session.status = 'approved';
    logger.info({ sessionId, goalId: goal.id }, 'Goal builder session approved');

    return { goalId: goal.id };
  }

  getSession(sessionId: string): GoalBuilderSession | null {
    return sessions.get(sessionId) ?? null;
  }

  private async _generatePlan(session: GoalBuilderSession): Promise<AIPlan> {
    const answersText = session.answers
      .map((a, i) => `Q${i + 1}: ${a.question}\nA${i + 1}: ${a.answer}`)
      .join('\n\n');

    const today = new Date().toISOString().substring(0, 10);
    const prompt =
      `Based on all the user's answers below for a "${session.templateName}" goal, ` +
      `create a detailed personalized plan. ` +
      `Return ONLY valid JSON: ` +
      `{"title":"...","summary":"...","milestones":[{"title":"...","week":1,"description":"..."}],` +
      `"tasks":[{"title":"...","description":"...","type":"ACTION|HABIT|REFLECTION","priority":"HIGH|MEDIUM|LOW","estimatedMinutes":30}],` +
      `"timeline":{"durationDays":90,"startDate":"${today}"}}\n\n` +
      `User answers:\n${answersText}`;

    const raw = await this.openClaw.sendMessage(AI_AGENT, prompt);
    return parsePlan(raw);
  }
}

// ── Parsing helpers ───────────────────────────────────────────────────────────

function parseQuestion(raw: string): AIQuestion {
  try {
    const match = raw.match(/\{[\s\S]*\}/);
    if (!match) throw new Error('No JSON object in response');
    const parsed = JSON.parse(match[0]) as Partial<AIQuestion>;
    if (!parsed.question) throw new Error('Missing question field');
    return {
      question: parsed.question,
      inputType: parsed.inputType ?? 'text',
      ...(parsed.options && { options: parsed.options }),
      ...(parsed.placeholder && { placeholder: parsed.placeholder }),
      ...(parsed.context && { context: parsed.context }),
      isLastQuestion: parsed.isLastQuestion ?? false,
    };
  } catch (err) {
    logger.error({ err, raw }, 'Failed to parse AI question response; using fallback');
    return {
      question: 'Tell me more about what you want to achieve with this goal.',
      inputType: 'text',
      placeholder: 'Describe your goal...',
      isLastQuestion: false,
    };
  }
}

function parsePlan(raw: string): AIPlan {
  const today = new Date().toISOString().substring(0, 10);
  try {
    const match = raw.match(/\{[\s\S]*\}/);
    if (!match) throw new Error('No JSON object in response');
    const parsed = JSON.parse(match[0]) as Partial<AIPlan>;
    return {
      title: parsed.title ?? 'Your Personalized Plan',
      summary: parsed.summary ?? '',
      milestones: Array.isArray(parsed.milestones) ? parsed.milestones : [],
      tasks: Array.isArray(parsed.tasks) ? parsed.tasks : [],
      timeline: {
        durationDays: parsed.timeline?.durationDays ?? 90,
        startDate: parsed.timeline?.startDate ?? today,
      },
    };
  } catch (err) {
    logger.error({ err, raw }, 'Failed to parse AI plan response; using fallback');
    return {
      title: 'Your Personalized Plan',
      summary: 'A plan tailored to your goals and circumstances.',
      milestones: [
        { title: 'Foundation', week: 1, description: 'Build the foundation' },
        { title: 'Progress', week: 4, description: 'Make measurable progress' },
        { title: 'Completion', week: 13, description: 'Achieve your goal' },
      ],
      tasks: [
        { title: 'First step', description: 'Take your first step toward the goal', type: 'ACTION', priority: 'HIGH', estimatedMinutes: 30 },
      ],
      timeline: { durationDays: 90, startDate: today },
    };
  }
}
