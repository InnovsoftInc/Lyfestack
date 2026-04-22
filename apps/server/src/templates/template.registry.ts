import { GoalTemplate } from '@lyfestack/shared';
import { productivityTemplate } from './definitions/productivity';
import { selfImprovementTemplate } from './definitions/self-improvement';
import { soloBusinessTemplate } from './definitions/solo-business';
import { socialMediaTemplate } from './definitions/social-media';
import { fitnessTemplate } from './definitions/fitness';

export class TemplateRegistry {
  private static instance: TemplateRegistry;
  private templates: Map<string, GoalTemplate> = new Map();

  private constructor() {
    this.register(productivityTemplate);
    this.register(selfImprovementTemplate);
    this.register(soloBusinessTemplate);
    this.register(socialMediaTemplate);
    this.register(fitnessTemplate);
  }

  static getInstance(): TemplateRegistry {
    if (!TemplateRegistry.instance) {
      TemplateRegistry.instance = new TemplateRegistry();
    }
    return TemplateRegistry.instance;
  }

  private register(template: GoalTemplate): void {
    this.templates.set(template.id, template);
  }

  getAll(): GoalTemplate[] {
    return Array.from(this.templates.values());
  }

  getById(id: string): GoalTemplate | undefined {
    return this.templates.get(id);
  }

  getByCategory(category: string): GoalTemplate[] {
    return this.getAll().filter(t => t.category === category);
  }
}
