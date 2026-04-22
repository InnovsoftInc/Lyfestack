import { request } from './api';

export interface DiagnosticQuestion {
  id: string;
  question: string;
  type: 'text' | 'scale' | 'choice' | 'boolean';
  options?: string[];
  min?: number;
  max?: number;
}

export interface TemplateDefinition {
  id: string;
  name: string;
  description: string;
  category: string;
  durationDays: number;
  milestones: string[];
  defaultTaskTypes: string[];
  diagnosticQuestions: DiagnosticQuestion[];
}

export async function getTemplates(): Promise<TemplateDefinition[]> {
  const res = await request<{ templates: TemplateDefinition[] }>('/templates');
  return res.templates;
}

export async function getTemplateById(id: string): Promise<TemplateDefinition> {
  const res = await request<{ template: TemplateDefinition }>(`/templates/${id}`);
  return res.template;
}
