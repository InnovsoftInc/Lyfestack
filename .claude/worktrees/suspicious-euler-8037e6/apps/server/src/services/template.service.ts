import { NotFoundError } from '../errors/AppError';
import { TemplateRegistry } from '../templates/registry';
import type { FullGoalTemplate } from '../templates/types';

export class TemplateService {
  list(category?: string, search?: string): FullGoalTemplate[] {
    if (search) return TemplateRegistry.search(search);
    if (category) return TemplateRegistry.getByCategory(category);
    return TemplateRegistry.getAll();
  }

  getById(id: string): FullGoalTemplate {
    const template = TemplateRegistry.getById(id);
    if (!template) throw new NotFoundError(`Template ${id}`);
    return template;
  }

  getCategories(): string[] {
    return TemplateRegistry.getCategories();
  }
}

export const templateService = new TemplateService();
