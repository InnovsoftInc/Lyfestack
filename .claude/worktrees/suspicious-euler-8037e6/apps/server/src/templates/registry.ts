import type { FullGoalTemplate } from './types';
import { fitnessTemplate } from './fitness.template';
import { financeTemplate } from './finance.template';
import { learningTemplate } from './learning.template';
import { careerTemplate } from './career.template';
import { creativeTemplate } from './creative.template';

const templates = new Map<string, FullGoalTemplate>([
  [fitnessTemplate.id, fitnessTemplate],
  [financeTemplate.id, financeTemplate],
  [learningTemplate.id, learningTemplate],
  [careerTemplate.id, careerTemplate],
  [creativeTemplate.id, creativeTemplate],
]);

export const TemplateRegistry = {
  getAll(): FullGoalTemplate[] {
    return Array.from(templates.values());
  },

  getById(id: string): FullGoalTemplate | undefined {
    return templates.get(id);
  },

  getByCategory(category: string): FullGoalTemplate[] {
    return Array.from(templates.values()).filter((t) => t.category === category);
  },

  search(query: string): FullGoalTemplate[] {
    const lower = query.toLowerCase();
    return Array.from(templates.values()).filter(
      (t) =>
        t.name.toLowerCase().includes(lower) ||
        t.description.toLowerCase().includes(lower) ||
        t.tags.some((tag) => tag.includes(lower)),
    );
  },

  register(template: FullGoalTemplate): void {
    templates.set(template.id, template);
  },

  getCategories(): string[] {
    return [...new Set(Array.from(templates.values()).map((t) => t.category))];
  },
};
