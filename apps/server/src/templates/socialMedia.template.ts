import { TrustTier } from '@lyfestack/shared';
import type { TemplateDefinition } from './types';

export const socialMediaTemplate: TemplateDefinition = {
  id: 'social-media',
  name: 'Social Media Growth',
  description:
    'Build an engaged audience and establish consistent content presence that drives real business results in 90 days.',
  category: 'content-creation',
  durationDays: 90,
  diagnosticQuestions: [
    {
      id: 'primary-platform',
      question: 'Which platform are you focusing on first?',
      type: 'choice',
      options: ['Twitter/X', 'LinkedIn', 'Instagram', 'TikTok', 'YouTube', 'Threads'],
    },
    {
      id: 'current-followers',
      question: 'What is your current follower count on your main platform?',
      type: 'choice',
      options: ['0-100', '100-500', '500-2,000', '2,000-10,000', '10,000+'],
    },
    {
      id: 'content-goal',
      question: 'What is the primary goal of your social media presence?',
      type: 'choice',
      options: [
        'Build personal brand',
        'Drive traffic to business',
        'Become a thought leader',
        'Generate direct revenue',
        'Build a community',
      ],
    },
    {
      id: 'posting-frequency',
      question: 'How consistently do you currently post content?',
      type: 'choice',
      options: ['Daily', 'A few times a week', 'Once a week', 'Rarely', 'Never started'],
    },
    {
      id: 'content-niche',
      question: 'Describe your niche and the specific audience you want to reach.',
      type: 'text',
    },
  ],
  milestones: [
    {
      id: 'sm-m1',
      title: 'Content System Built',
      description: 'Content calendar, templates, and batching workflow established',
      weekOffset: 2,
      successCriteria: [
        '30-day content calendar created',
        'At least 10 post templates or formats defined',
        'Weekly content batching session scheduled',
      ],
    },
    {
      id: 'sm-m2',
      title: 'Consistent Posting Achieved',
      description: '4+ weeks of consistent daily or near-daily posting',
      weekOffset: 6,
      successCriteria: [
        'Posted at least 4 days per week for 4 consecutive weeks',
        'Engagement rate baseline established',
        'First viral or high-performing post identified and analyzed',
      ],
    },
    {
      id: 'sm-m3',
      title: 'Audience Engagement Established',
      description: 'Genuine two-way engagement and community forming',
      weekOffset: 10,
      successCriteria: [
        'Average 20+ engagements per post',
        'Reply to 100% of comments within 24 hours',
        'At least 10 meaningful DM conversations started',
      ],
    },
    {
      id: 'sm-m4',
      title: 'Growth Goal Hit',
      description: 'Follower/subscriber target reached with quality audience',
      weekOffset: 13,
      successCriteria: [
        'Follower growth target achieved',
        'At least one collaboration or shoutout completed',
        'Audience driving at least one measurable business outcome',
      ],
    },
  ],
  allowedActions: [
    {
      type: 'create_post',
      description: 'Draft and schedule content for the platform',
      frequency: 'daily',
    },
    {
      type: 'engage_audience',
      description: 'Reply to comments, DMs, and engage with similar accounts',
      frequency: 'daily',
    },
    {
      type: 'content_analytics_review',
      description: 'Review performance metrics and identify winning formats',
      frequency: 'weekly',
    },
    {
      type: 'repurpose_content',
      description: 'Transform top-performing content into new formats',
      frequency: 'weekly',
    },
  ],
  automationRules: [
    {
      id: 'sm-ar1',
      trigger: 'posting_gap',
      condition: 'No post published in 48+ hours',
      action: 'Send alert and suggest quick post idea based on content backlog',
      trustTierRequired: TrustTier.ASSISTED,
    },
    {
      id: 'sm-ar2',
      trigger: 'high_engagement_post',
      condition: 'Post receives 3x average engagement within 4 hours',
      action: 'Flag as top content and suggest repurposing into thread, video, or newsletter',
      trustTierRequired: TrustTier.ASSISTED,
    },
    {
      id: 'sm-ar3',
      trigger: 'weekly_post_minimum_met',
      condition: 'Posted target frequency for 7 consecutive days',
      action: 'Unlock achievement and suggest incremental frequency increase experiment',
      trustTierRequired: TrustTier.AUTONOMOUS,
    },
  ],
  leadingIndicators: [
    {
      id: 'sm-li1',
      metric: 'posts_published',
      description: 'Content pieces published per week',
      targetFrequency: 'weekly',
      unit: 'posts',
      targetValue: 5,
    },
    {
      id: 'sm-li2',
      metric: 'engagement_rate',
      description: 'Average engagement rate per post',
      targetFrequency: 'weekly',
      unit: 'percent',
      targetValue: 3,
    },
    {
      id: 'sm-li3',
      metric: 'follower_growth',
      description: 'Net new followers gained this week',
      targetFrequency: 'weekly',
      unit: 'followers',
    },
    {
      id: 'sm-li4',
      metric: 'engagement_actions',
      description: 'Comments replied to and DMs sent per day',
      targetFrequency: 'daily',
      unit: 'interactions',
      targetValue: 20,
    },
  ],
  defaultTaskTypes: ['ACTION', 'HABIT', 'SOCIAL'],
};
