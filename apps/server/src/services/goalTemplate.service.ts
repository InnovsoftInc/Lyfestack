import { TemplateRegistry, TemplateDefinition } from '../templates/TemplateRegistry';
import { NotFoundError } from '../errors/AppError';

export class GoalTemplateService {
  listTemplates(): TemplateDefinition[] {
    return TemplateRegistry.getAll();
  }

  getTemplate(id: string): TemplateDefinition {
    const template = TemplateRegistry.getById(id);
    if (!template) {
      throw new NotFoundError(`Template '${id}'`);
    }
    return template;
  }
}

export const goalTemplateService = new GoalTemplateService();
