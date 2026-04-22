import type { TrustTier } from '@lyfestack/shared';

export type QuestionType = 'text' | 'scale' | 'choice';

export interface DiagnosticQuestion {
  id: string;
  question: string;
  type: QuestionType;
  options?: string[];
  scaleMin?: number;
  scaleMax?: number;
}

export interface TemplateMilestone {
  id: string;
  title: string;
  description: string;
  weekOffset: number;
  successCriteria: string[];
}

export interface AllowedAction {
  type: string;
  description: string;
  frequency: 'daily' | 'weekly' | 'monthly' | 'as-needed';
}

export interface AutomationRule {
  id: string;
  trigger: string;
  condition: string;
  action: string;
  trustTierRequired: TrustTier;
}

export interface LeadingIndicator {
  id: string;
  metric: string;
  description: string;
  targetFrequency: 'daily' | 'weekly';
  unit: string;
  targetValue?: number;
}

export interface TemplateDefinition {
  id: string;
  name: string;
  description: string;
  category: string;
  durationDays: number;
  diagnosticQuestions: DiagnosticQuestion[];
  milestones: TemplateMilestone[];
  allowedActions: AllowedAction[];
  automationRules: AutomationRule[];
  leadingIndicators: LeadingIndicator[];
  defaultTaskTypes: string[];
}
