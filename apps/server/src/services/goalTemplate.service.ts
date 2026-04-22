import { templateRegistry } from '../templates/TemplateRegistry';
import type { TemplateDefinition } from '../templates/types';
import { NotFoundError } from '../errors/AppError';

export class GoalTemplateService {
  listTemplates(): TemplateDefinition[] {
    return templateRegistry.getAll();
  }

  getTemplate(id: string): TemplateDefinition {
    const template = templateRegistry.getById(id);
    if (!template) {
      throw new NotFoundError(`Template '${id}'`);
    }
    return template;
  }
}

export const goalTemplateService = new GoalTemplateService();
