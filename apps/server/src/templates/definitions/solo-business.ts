import { GoalTemplate } from '@lyfestack/shared';

export const soloBusinessTemplate: GoalTemplate = {
  id: 'tmpl_solo_business',
  name: 'Solo Business Growth',
  description: 'Grow your solo business with structured marketing, sales, and operations improvements.',
  category: 'business',
  icon: 'briefcase',
  durationDays: 90,
  diagnosticQuestions: [
    { id: 'q1', question: 'What type of business do you run?', type: 'text', required: true },
    { id: 'q2', question: 'What is your current monthly revenue?', type: 'select', options: ['$0 (pre-revenue)', 'Under $1K', '$1K-$5K', '$5K-$10K', '$10K-$50K', '$50K+'], required: true },
    { id: 'q3', question: 'What is your biggest bottleneck right now?', type: 'select', options: ['Getting customers', 'Retaining customers', 'Pricing', 'Operations', 'Marketing', 'Product quality'], required: true },
    { id: 'q4', question: 'Which marketing channels are you using?', type: 'multiselect', options: ['Social media', 'SEO', 'Paid ads', 'Email marketing', 'Referrals', 'Cold outreach', 'None'], required: true },
    { id: 'q5', question: 'What is your revenue goal for the next 90 days?', type: 'text', required: true },
    { id: 'q6', question: 'How many hours per week do you work on your business?', type: 'number', required: true },
  ],
  milestones: ['Audit current operations', 'Define growth strategy', 'Launch marketing campaign', 'First new customer from strategy', 'Optimize pricing', 'Hit revenue target'],
  defaultTaskTypes: ['marketing', 'operations', 'sales', 'analytics', 'content'],
  allowedActions: ['generate_content', 'schedule_posts', 'analyze_metrics', 'draft_email', 'research_competitors'],
  automationRules: ['weekly_metrics_review', 'content_calendar', 'competitor_monitoring'],
  leadingIndicators: [
    { name: 'Monthly revenue', description: 'Total revenue this month', unit: '$', targetDirection: 'increase' },
    { name: 'New customers', description: 'New customers acquired', unit: 'count', targetDirection: 'increase' },
    { name: 'Conversion rate', description: 'Lead to customer conversion', unit: '%', targetDirection: 'increase' },
  ],
};
