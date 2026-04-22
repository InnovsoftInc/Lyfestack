import type { DiagnosticAnswer, TemplateDefinition } from '../../templates/template.types';
import type { PlanDraft, UserContext } from './planning.types';

export interface IPlanningStrategy {
  generate(
    template: TemplateDefinition,
    answers: DiagnosticAnswer[],
    context: UserContext,
  ): PlanDraft;
}

export function getAnswer(
  answers: DiagnosticAnswer[],
  questionId: string,
): string | number | boolean | undefined {
  return answers.find((a) => a.questionId === questionId)?.value;
}

export function scaleTaskLoad(
  baseTasks: number,
  engagementVelocity: number,
  currentTaskLoad: number,
): number {
  const velocityFactor = 0.5 + engagementVelocity * 0.5;
  const loadFactor = Math.max(0.3, 1 - currentTaskLoad / 10);
  return Math.max(1, Math.round(baseTasks * velocityFactor * loadFactor));
}
