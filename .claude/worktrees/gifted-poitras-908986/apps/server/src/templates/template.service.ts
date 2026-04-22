import { NotFoundError } from '../errors/AppError';
import { TEMPLATE_REGISTRY } from './template.registry';
import type { TemplateCategory, TemplateDefinition } from './template.types';

export class TemplateService {
  getAll(): TemplateDefinition[] {
    return TEMPLATE_REGISTRY;
  }

  getById(id: string): TemplateDefinition {
    const template = TEMPLATE_REGISTRY.find((t) => t.id === id);
    if (!template) throw new NotFoundError(`Template ${id}`);
    return template;
  }

  getByCategory(category: TemplateCategory): TemplateDefinition[] {
    return TEMPLATE_REGISTRY.filter((t) => t.category === category);
  }
}

export const templateService = new TemplateService();
