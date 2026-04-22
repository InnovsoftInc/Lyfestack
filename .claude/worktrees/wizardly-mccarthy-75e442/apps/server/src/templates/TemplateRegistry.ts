import type { TemplateDefinition } from './types';
import { productivityTemplate } from './productivity.template';
import { selfImprovementTemplate } from './selfImprovement.template';
import { soloBusinessTemplate } from './soloBusiness.template';
import { socialMediaTemplate } from './socialMedia.template';
import { fitnessTemplate } from './fitness.template';

const ALL_TEMPLATES: TemplateDefinition[] = [
  productivityTemplate,
  selfImprovementTemplate,
  soloBusinessTemplate,
  socialMediaTemplate,
  fitnessTemplate,
];

class TemplateRegistry {
  private static instance: TemplateRegistry;
  private readonly templates: Map<string, TemplateDefinition>;

  private constructor() {
    this.templates = new Map();
    for (const template of ALL_TEMPLATES) {
      this.templates.set(template.id, template);
    }
  }

  static getInstance(): TemplateRegistry {
    if (!TemplateRegistry.instance) {
      TemplateRegistry.instance = new TemplateRegistry();
    }
    return TemplateRegistry.instance;
  }

  getAll(): TemplateDefinition[] {
    return Array.from(this.templates.values());
  }

  getById(id: string): TemplateDefinition | undefined {
    return this.templates.get(id);
  }
}

export const templateRegistry = TemplateRegistry.getInstance();
