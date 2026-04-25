import { v4 as uuidv4 } from 'uuid';
import { OpenClawService } from '../integrations/openclaw/openclaw.service';
import type { GoalService } from './goal.service';
import type { PlanRepository } from '../repositories/plan.repository';
import type { AutomationsService, Routine } from '../automations/automations.service';
import { GoalStatus } from '@lyfestack/shared';
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
    private readonly planRepository: PlanRepository | null = null,
    private readonly automations: AutomationsService | null = null,
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
  ): Promise<{ goalId: string; planId?: string; automationId?: string }> {
    const session = sessions.get(sessionId);
    if (!session) throw new Error(`Session ${sessionId} not found`);

    const diagnosticAnswers = session.answers.map((a, i) => ({
      questionId: `q-${i}`,
      value: a.answer,
    }));

    const plan = applyPlanModifications(session.generatedPlan, modifications);
    const goal = await this.goalService.createGoal({
      userId: session.userId,
      title: plan?.title ?? session.templateName,
      description: plan?.summary ?? '',
      templateId: session.templateId,
      diagnosticAnswers,
      ...(plan?.timeline?.durationDays ? {
        targetDate: new Date(Date.now() + plan.timeline.durationDays * 86_400_000).toISOString().slice(0, 10),
      } : {}),
    });

    let planId: string | undefined;
    if (this.planRepository && plan) {
      const startDate = plan.timeline.startDate || new Date().toISOString().slice(0, 10);
      const end = new Date(startDate);
      end.setDate(end.getDate() + plan.timeline.durationDays);
      const savedPlan = await this.planRepository.create({
        user_id: session.userId,
        title: plan.title,
        description: plan.summary,
        status: GoalStatus.ACTIVE,
        start_date: startDate,
        end_date: end.toISOString().slice(0, 10),
      });
      await this.planRepository.addGoal(savedPlan.id, goal.id);
      planId = savedPlan.id;
    }

    let automation: Routine | null = null;
    if (this.automations && plan) {
      automation = await this.automations.create({
        name: `${plan.title} Daily Check-in`,
        schedule: '0 8 * * *',
        agent: 'main',
        prompt: buildAutomationPrompt(plan),
        enabled: true,
        notify: { channel: 'telegram' },
      }).catch((err) => {
        logger.warn({ err, sessionId, goalId: goal.id }, 'Goal builder automation creation failed');
        return null;
      });
    }

    session.status = 'approved';
    logger.info({ sessionId, goalId: goal.id, planId, automationId: automation?.id }, 'Goal builder session approved');

    return {
      goalId: goal.id,
      ...(planId ? { planId } : {}),
      ...(automation?.id ? { automationId: automation.id } : {}),
    };
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

function applyPlanModifications(plan: AIPlan | null, modifications?: SessionTaskModification): AIPlan | null {
  if (!plan) return null;
  const next: AIPlan = JSON.parse(JSON.stringify(plan)) as AIPlan;

  for (const edit of modifications?.editedMilestones ?? []) {
    if (next.milestones[edit.index]) next.milestones[edit.index]!.title = edit.title;
  }

  const removed = new Set(modifications?.removedTaskIndices ?? []);
  if (removed.size) next.tasks = next.tasks.filter((_, index) => !removed.has(index));

  for (const task of modifications?.addedTasks ?? []) {
    next.tasks.push({
      title: task.title,
      description: task.description,
      type: 'ACTION',
      priority: 'MEDIUM',
      estimatedMinutes: 30,
    });
  }

  if (modifications?.timelineOverride?.durationDays) {
    next.timeline.durationDays = modifications.timelineOverride.durationDays;
  }

  return next;
}

function buildAutomationPrompt(plan: AIPlan): string {
  const milestones = plan.milestones
    .map((m) => `- Week ${m.week}: ${m.title} — ${m.description}`)
    .join('\n');
  const tasks = plan.tasks
    .slice(0, 12)
    .map((t) => `- [${t.priority}] ${t.title}: ${t.description} (${t.estimatedMinutes} min)`)
    .join('\n');

  return [
    `Goal: ${plan.title}`,
    `Summary: ${plan.summary}`,
    `Timeline: ${plan.timeline.durationDays} days starting ${plan.timeline.startDate}`,
    milestones ? `Milestones:\n${milestones}` : '',
    tasks ? `Tasks:\n${tasks}` : '',
    'Every morning, send a short practical check-in that picks the highest-leverage action for today, reminds the user why it matters, and asks for a simple completion reply.',
  ].filter(Boolean).join('\n\n');
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
