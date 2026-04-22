import { NotFoundError } from '../errors/AppError';
import { TEMPLATE_REGISTRY } from './template.registry';
import type { TemplateCategory, TemplateDefinition } from './template.types';
import { logger } from '../utils/logger';
import type { GoalTemplate } from '@lyfestack/shared';

// Lazily initialized with a DB repository when available
let _instance: TemplateService | null = null;

function getInstance(): TemplateService {
  if (!_instance) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { getSupabaseClient } = require('../config/database') as {
        getSupabaseClient: () => import('@supabase/supabase-js').SupabaseClient;
      };
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { GoalTemplateRepository } = require('../repositories/goal-template.repository') as {
        GoalTemplateRepository: new (c: import('@supabase/supabase-js').SupabaseClient) => import('../repositories/goal-template.repository').GoalTemplateRepository;
      };
      _instance = new TemplateService(new GoalTemplateRepository(getSupabaseClient()));
    } catch {
      _instance = new TemplateService(null);
    }
  }
  return _instance;
}

export class TemplateService {
  constructor(
    private readonly templateRepository: import('../repositories/goal-template.repository').GoalTemplateRepository | null = null,
  ) {}

  async getAll(): Promise<TemplateDefinition[]> {
    if (this.templateRepository) {
      try {
        const rows = await this.templateRepository.findAllActive();
        if (rows.length > 0) return rows.map(mapGoalTemplate);
      } catch (err) {
        logger.warn({ err }, 'DB template fetch failed, falling back to registry');
      }
    }
    return TEMPLATE_REGISTRY;
  }

  async getById(id: string): Promise<TemplateDefinition> {
    if (this.templateRepository) {
      try {
        const row = await this.templateRepository.findById(id);
        if (row) return mapGoalTemplate(row);
      } catch (err) {
        logger.warn({ err, id }, 'DB template fetch by ID failed, falling back to registry');
      }
    }
    const tpl = TEMPLATE_REGISTRY.find((t) => t.id === id);
    if (!tpl) throw new NotFoundError(`Template ${id}`);
    return tpl;
  }

  async getByCategory(category: TemplateCategory): Promise<TemplateDefinition[]> {
    if (this.templateRepository) {
      try {
        const rows = await this.templateRepository.findByCategory(category);
        if (rows.length > 0) return rows.map(mapGoalTemplate);
      } catch (err) {
        logger.warn({ err }, 'DB template fetch by category failed, falling back to registry');
      }
    }
    return TEMPLATE_REGISTRY.filter((t) => t.category === category);
  }
}

function mapGoalTemplate(t: GoalTemplate): TemplateDefinition {
  return {
    id: t.id,
    name: t.name,
    description: t.description,
    category: t.category as TemplateCategory,
    durationDays: t.durationDays,
    milestones: Array.isArray(t.milestones) ? t.milestones : [],
    defaultTaskTypes: Array.isArray(t.defaultTaskTypes) ? t.defaultTaskTypes : [],
    diagnosticQuestions: Array.isArray(t.diagnosticQuestions)
      ? (t.diagnosticQuestions as TemplateDefinition['diagnosticQuestions'])
      : [],
  };
}

// Module-level proxy so existing imports (`templateService.getById(...)`) keep working
export const templateService = {
  getAll: () => getInstance().getAll(),
  getById: (id: string) => getInstance().getById(id),
  getByCategory: (category: TemplateCategory) => getInstance().getByCategory(category),
};
