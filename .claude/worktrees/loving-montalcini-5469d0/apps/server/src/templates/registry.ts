import type { GoalTemplate } from '@lyfestack/shared';
import { healthFitnessTemplate } from './health-fitness.template';
import { careerTemplate } from './career.template';
import { financialTemplate } from './financial.template';
import { relationshipsTemplate } from './relationships.template';
import { learningTemplate } from './learning.template';

export const ALL_TEMPLATES: GoalTemplate[] = [
  healthFitnessTemplate,
  careerTemplate,
  financialTemplate,
  relationshipsTemplate,
  learningTemplate,
];

const templateMap = new Map<string, GoalTemplate>(
  ALL_TEMPLATES.map((t) => [t.id, t]),
);

export function getTemplate(id: string): GoalTemplate | undefined {
  return templateMap.get(id);
}

export function getTemplateOrThrow(id: string): GoalTemplate {
  const template = templateMap.get(id);
  if (!template) {
    throw new Error(`Unknown template id: "${id}". Available: ${ALL_TEMPLATES.map((t) => t.id).join(', ')}`);
  }
  return template;
}

export function listTemplates(): GoalTemplate[] {
  return ALL_TEMPLATES;
}
