import { GOAL_TEMPLATES, type FullGoalTemplate } from './templates.data';

export class TemplateRegistry {
  private static instance: TemplateRegistry;
  private templates: Map<string, FullGoalTemplate>;

  private constructor() {
    this.templates = new Map(GOAL_TEMPLATES.map((t) => [t.id, t]));
  }

  static getInstance(): TemplateRegistry {
    if (!TemplateRegistry.instance) {
      TemplateRegistry.instance = new TemplateRegistry();
    }
    return TemplateRegistry.instance;
  }

  getAll(): FullGoalTemplate[] {
    return Array.from(this.templates.values());
  }

  getById(id: string): FullGoalTemplate | undefined {
    return this.templates.get(id);
  }

  getByCategory(category: FullGoalTemplate['category']): FullGoalTemplate[] {
    return this.getAll().filter((t) => t.category === category);
  }

  matchTemplate(keywords: string[]): FullGoalTemplate | undefined {
    const lower = keywords.map((k) => k.toLowerCase());
    return this.getAll().find((t) =>
      lower.some(
        (kw) =>
          t.name.toLowerCase().includes(kw) ||
          t.category.toLowerCase().includes(kw) ||
          t.description.toLowerCase().includes(kw),
      ),
    );
  }
}
