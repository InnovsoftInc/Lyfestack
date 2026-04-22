import { TemplateRegistry } from '../templates/TemplateRegistry';
import type { FullGoalTemplate } from '../templates/templates.data';
import { NotFoundError } from '../errors/AppError';

export class GoalTemplateService {
  private registry = TemplateRegistry.getInstance();

  getAll(): FullGoalTemplate[] {
    return this.registry.getAll();
  }

  getById(id: string): FullGoalTemplate {
    const template = this.registry.getById(id);
    if (!template) throw new NotFoundError(`Template ${id} not found`);
    return template;
  }

  matchTemplate(keywords: string[]): FullGoalTemplate | undefined {
    return this.registry.matchTemplate(keywords);
  }
}

export const goalTemplateService = new GoalTemplateService();
