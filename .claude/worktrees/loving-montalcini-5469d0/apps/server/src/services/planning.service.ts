import { v4 as uuidv4 } from 'uuid';
import { GoalStatus, TaskStatus, TaskType, ApprovalState } from '@lyfestack/shared';
import type { Goal, GoalMilestone, Plan, Task } from '@lyfestack/shared';
import { getTemplateOrThrow } from '../templates/registry';
import type { DiagnosticQuestion, MilestoneTemplate } from '@lyfestack/shared';

export interface DiagnosticAnswer {
  questionId: string;
  value: string | string[] | number;
}

export interface PlanningInput {
  userId: string;
  templateId: string;
  goalTitle: string;
  answers: DiagnosticAnswer[];
}

export interface GeneratedPlan {
  goal: Goal;
  plan: Plan;
  milestones: GoalMilestone[];
  tasks: Task[];
}

function resolveAnswer(answers: DiagnosticAnswer[], questionId: string): DiagnosticAnswer['value'] | undefined {
  return answers.find((a) => a.questionId === questionId)?.value;
}

function daysFromNow(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString();
}

function personaliseMilestoneTitle(
  milestone: MilestoneTemplate,
  answers: DiagnosticAnswer[],
  questions: DiagnosticQuestion[],
): string {
  // For the first diagnostic answer that is a `select` type, weave it into milestone copy
  const firstSelect = questions.find((q) => q.type === 'select');
  if (!firstSelect) return milestone.title;
  const answer = resolveAnswer(answers, firstSelect.id);
  if (typeof answer !== 'string') return milestone.title;
  return `${milestone.title} (${answer.toLowerCase()})`;
}

function pickInitialTasks(
  goal: Goal,
  userId: string,
  answers: DiagnosticAnswer[],
  questions: DiagnosticQuestion[],
  templateId: string,
): Task[] {
  const template = getTemplateOrThrow(templateId);
  const now = new Date().toISOString();

  // Determine how much time the user has per day (look for a scale question as a proxy)
  const scaleQuestion = questions.find((q) => q.type === 'scale');
  const availableMinutes = scaleQuestion
    ? Number(resolveAnswer(answers, scaleQuestion.id) ?? scaleQuestion.max ?? 30)
    : 30;

  // Filter suggested actions to those that fit the user's time budget
  const eligible = template.suggestedActions.filter((a) => {
    if (a.frequency === 'once') return true;
    const mins = a.durationMinutes ?? 0;
    return mins <= availableMinutes;
  });

  // Always include at least 3 actions; take up to 5
  const selected = eligible.slice(0, 5);

  return selected.map((action) => {
    const task: Task = {
      id: uuidv4(),
      goalId: goal.id,
      userId,
      title: action.title,
      description: action.description,
      type: action.type as TaskType,
      status: TaskStatus.PENDING_APPROVAL,
      approvalState: ApprovalState.PENDING,
      scheduledFor: action.frequency === 'daily' ? daysFromNow(0) : daysFromNow(1),
      createdAt: now,
      updatedAt: now,
    };
    if (action.durationMinutes !== undefined) {
      task.durationMinutes = action.durationMinutes;
    }
    return task;
  });
}

export function generatePlan(input: PlanningInput): GeneratedPlan {
  const { userId, templateId, goalTitle, answers } = input;
  const template = getTemplateOrThrow(templateId);
  const now = new Date().toISOString();
  const goalId = uuidv4();
  const planId = uuidv4();

  const goal: Goal = {
    id: goalId,
    userId,
    templateId,
    title: goalTitle,
    description: template.description,
    status: GoalStatus.ACTIVE,
    targetDate: daysFromNow(template.durationDays),
    progressScore: 0,
    milestones: [],
    createdAt: now,
    updatedAt: now,
  };

  const milestones: GoalMilestone[] = template.milestoneTemplates.map((mt) => ({
    id: uuidv4(),
    goalId,
    title: personaliseMilestoneTitle(mt, answers, template.diagnosticQuestions),
    dueDate: daysFromNow(mt.dayOffset),
  }));

  goal.milestones = milestones;

  const plan: Plan = {
    id: planId,
    userId,
    title: `${goalTitle} — ${template.durationDays}-day plan`,
    description: buildPlanDescription(template.name, answers, template.diagnosticQuestions),
    goalIds: [goalId],
    status: GoalStatus.ACTIVE,
    startDate: now,
    endDate: daysFromNow(template.durationDays),
    createdAt: now,
    updatedAt: now,
  };

  const tasks = pickInitialTasks(goal, userId, answers, template.diagnosticQuestions, templateId);

  return { goal, plan, milestones, tasks };
}

function buildPlanDescription(
  templateName: string,
  answers: DiagnosticAnswer[],
  questions: DiagnosticQuestion[],
): string {
  const highlights = answers
    .slice(0, 3)
    .map((a) => {
      const q = questions.find((q) => q.id === a.questionId);
      if (!q) return null;
      const val = Array.isArray(a.value) ? a.value.join(', ') : String(a.value);
      return `${q.text.replace('?', '')}: ${val}`;
    })
    .filter(Boolean);

  const summary = highlights.length
    ? `Personalised around your context — ${highlights.join('; ')}.`
    : '';

  return `A structured ${templateName} plan. ${summary}`.trim();
}

export function validateAnswers(
  templateId: string,
  answers: DiagnosticAnswer[],
): { valid: boolean; missing: string[] } {
  const template = getTemplateOrThrow(templateId);
  const requiredIds = template.diagnosticQuestions
    .filter((q) => q.required)
    .map((q) => q.id);
  const answeredIds = new Set(answers.map((a) => a.questionId));
  const missing = requiredIds.filter((id) => !answeredIds.has(id));
  return { valid: missing.length === 0, missing };
}
