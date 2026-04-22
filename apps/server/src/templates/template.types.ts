export enum TemplateCategory {
  FITNESS = 'FITNESS',
  FINANCE = 'FINANCE',
  CAREER = 'CAREER',
  CREATIVITY = 'CREATIVITY',
  RELATIONSHIPS = 'RELATIONSHIPS',
  HEALTH = 'HEALTH',
  PRODUCTIVITY = 'PRODUCTIVITY',
  LEARNING = 'LEARNING',
}

export type QuestionType = 'text' | 'scale' | 'choice' | 'boolean';

export interface DiagnosticQuestion {
  id: string;
  question: string;
  type: QuestionType;
  options?: string[];
  min?: number;
  max?: number;
}

export interface DiagnosticAnswer {
  questionId: string;
  value: string | number | boolean;
}

export interface TemplateDefinition {
  id: string;
  name: string;
  description: string;
  category: TemplateCategory;
  durationDays: number;
  milestones: string[];
  defaultTaskTypes: string[];
  diagnosticQuestions: DiagnosticQuestion[];
}
