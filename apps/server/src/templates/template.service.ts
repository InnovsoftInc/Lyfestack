import { GoalTemplate } from '@lyfestack/shared';
import { TemplateRegistry } from './template.registry';
import { NotFoundError } from '../errors/AppError';

export class TemplateService {
  private registry = TemplateRegistry.getInstance();

  getAll(): GoalTemplate[] {
    return this.registry.getAll();
  }

  getById(id: string): GoalTemplate {
    const template = this.registry.getById(id);
    if (!template) throw new NotFoundError(`Template ${id} not found`);
    return template;
  }

  getByCategory(category: string): GoalTemplate[] {
    return this.registry.getByCategory(category);
  }
}
