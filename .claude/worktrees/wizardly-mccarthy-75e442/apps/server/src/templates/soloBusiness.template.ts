import { TrustTier } from '@lyfestack/shared';
import type { TemplateDefinition } from './types';

export const soloBusinessTemplate: TemplateDefinition = {
  id: 'solo-business',
  name: 'Solo Business Launch',
  description:
    'Go from idea to your first $1,000 in revenue as a one-person business in 365 days.',
  category: 'entrepreneurship',
  durationDays: 365,
  diagnosticQuestions: [
    {
      id: 'business-stage',
      question: 'Where are you in your business journey?',
      type: 'choice',
      options: [
        'Idea stage (no product yet)',
        'Building MVP',
        'Have product, no customers',
        'Have customers, scaling',
        'Established business',
      ],
    },
    {
      id: 'revenue-goal',
      question: 'What monthly revenue target do you want to hit within a year?',
      type: 'choice',
      options: [
        '$500/month',
        '$1,000/month',
        '$3,000/month',
        '$5,000/month',
        '$10,000+/month',
      ],
    },
    {
      id: 'skills',
      question: 'What is your primary business skill set?',
      type: 'choice',
      options: [
        'Service/consulting',
        'Software/tech',
        'Content/media',
        'Physical products',
        'Teaching/coaching',
      ],
    },
    {
      id: 'time-available',
      question: 'How many hours per week can you dedicate to the business?',
      type: 'scale',
      scaleMin: 5,
      scaleMax: 60,
    },
    {
      id: 'unique-advantage',
      question: "What unique advantage or insight do you bring that others don't?",
      type: 'text',
    },
  ],
  milestones: [
    {
      id: 'sb-m1',
      title: 'Idea Validated',
      description: '10 potential customers interviewed and problem confirmed',
      weekOffset: 4,
      successCriteria: [
        'Completed 10+ customer discovery interviews',
        'Identified 3 recurring pain points',
        'At least 2 people said they would pay for a solution',
      ],
    },
    {
      id: 'sb-m2',
      title: 'MVP Launched',
      description: 'First version of product or service available to customers',
      weekOffset: 12,
      successCriteria: [
        'MVP built and deployed or service packaged',
        'Landing page live with clear value proposition',
        'Pricing defined and payment method set up',
      ],
    },
    {
      id: 'sb-m3',
      title: 'First Customer',
      description: 'First paying customer acquired',
      weekOffset: 16,
      successCriteria: [
        'First payment received',
        'Customer onboarded and activated',
        'Gathered initial feedback',
      ],
    },
    {
      id: 'sb-m4',
      title: 'Revenue Consistency',
      description: '3 consecutive months of growing revenue',
      weekOffset: 32,
      successCriteria: [
        'Monthly revenue growing month-over-month',
        'At least 5 paying customers',
        'Customer acquisition channel identified and repeatable',
      ],
    },
    {
      id: 'sb-m5',
      title: 'Systems Built',
      description: 'Core business operations running on autopilot',
      weekOffset: 44,
      successCriteria: [
        'Customer onboarding automated',
        'Revenue collection automated',
        'Content or marketing system producing consistent leads',
      ],
    },
    {
      id: 'sb-m6',
      title: 'Revenue Target Hit',
      description: 'Monthly revenue target achieved for 2 consecutive months',
      weekOffset: 52,
      successCriteria: [
        'Revenue target hit 2 months in a row',
        'Business is profitable',
        'Clear path to next revenue tier mapped out',
      ],
    },
  ],
  allowedActions: [
    {
      type: 'customer_outreach',
      description: 'Reach out to potential customers for discovery or sales',
      frequency: 'daily',
    },
    {
      type: 'content_creation',
      description: 'Create content to build audience and attract leads',
      frequency: 'daily',
    },
    {
      type: 'revenue_review',
      description: 'Review revenue, pipeline, and financial metrics',
      frequency: 'weekly',
    },
    {
      type: 'product_iteration',
      description: 'Ship improvements based on customer feedback',
      frequency: 'weekly',
    },
    {
      type: 'strategic_review',
      description: 'Quarterly business strategy assessment and planning',
      frequency: 'monthly',
    },
  ],
  automationRules: [
    {
      id: 'sb-ar1',
      trigger: 'no_customer_contact',
      condition: 'No customer outreach logged in 3+ days',
      action: 'Schedule customer contact session and suggest 5 people to reach out to',
      trustTierRequired: TrustTier.ASSISTED,
    },
    {
      id: 'sb-ar2',
      trigger: 'revenue_milestone_approaching',
      condition: 'Within 30 days of target milestone with revenue gap > 30%',
      action: 'Create intensive sprint plan with daily revenue-generating tasks',
      trustTierRequired: TrustTier.ASSISTED,
    },
    {
      id: 'sb-ar3',
      trigger: 'winning_channel_identified',
      condition: 'One acquisition channel producing 60%+ of leads for 4 consecutive weeks',
      action: 'Double down plan: suggest allocating 70% of effort to top channel',
      trustTierRequired: TrustTier.AUTONOMOUS,
    },
    {
      id: 'sb-ar4',
      trigger: 'churn_detected',
      condition: 'Customer cancels or goes inactive within first 30 days',
      action: 'Schedule win-back call and trigger feedback collection sequence',
      trustTierRequired: TrustTier.ASSISTED,
    },
  ],
  leadingIndicators: [
    {
      id: 'sb-li1',
      metric: 'customer_conversations',
      description: 'Customer discovery or sales conversations per week',
      targetFrequency: 'weekly',
      unit: 'conversations',
      targetValue: 5,
    },
    {
      id: 'sb-li2',
      metric: 'content_pieces',
      description: 'Content pieces published per week',
      targetFrequency: 'weekly',
      unit: 'pieces',
      targetValue: 3,
    },
    {
      id: 'sb-li3',
      metric: 'revenue',
      description: 'Monthly recurring or project revenue',
      targetFrequency: 'weekly',
      unit: 'usd',
    },
    {
      id: 'sb-li4',
      metric: 'pipeline_value',
      description: 'Total value of active sales opportunities',
      targetFrequency: 'weekly',
      unit: 'usd',
    },
    {
      id: 'sb-li5',
      metric: 'shipping_velocity',
      description: 'Product improvements or features shipped per week',
      targetFrequency: 'weekly',
      unit: 'deployments',
      targetValue: 1,
    },
  ],
  defaultTaskTypes: ['ACTION', 'MILESTONE', 'HABIT'],
};
