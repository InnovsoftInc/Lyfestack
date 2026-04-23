import { request } from './api';

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

export async function startGoalBuilder(
  templateId: string,
  templateName: string,
): Promise<{ sessionId: string; question: AIQuestion }> {
  return request('/api/goal-builder/start', {
    method: 'POST',
    body: { templateId, templateName },
  });
}

export async function answerGoalBuilderQuestion(
  sessionId: string,
  answer: string,
): Promise<{ question?: AIQuestion; plan?: AIPlan; done: boolean }> {
  return request('/api/goal-builder/answer', {
    method: 'POST',
    body: { sessionId, answer },
  });
}

export async function approveGoalBuilder(
  sessionId: string,
  modifications?: SessionTaskModification,
): Promise<{ goalId: string }> {
  return request('/api/goal-builder/approve', {
    method: 'POST',
    body: { sessionId, modifications },
  });
}

export async function getGoalBuilderSession(sessionId: string): Promise<{ session: unknown }> {
  return request(`/api/goal-builder/session/${sessionId}`);
}
