import { GoalTemplate } from '@lyfestack/shared';

export const socialMediaTemplate: GoalTemplate = {
  id: 'tmpl_social_media',
  name: 'Social Media Growth',
  description: 'Grow your social media presence with consistent content, engagement strategies, and analytics.',
  category: 'social-media',
  icon: 'share-2',
  durationDays: 60,
  diagnosticQuestions: [
    { id: 'q1', question: 'Which platforms are you active on?', type: 'multiselect', options: ['Instagram', 'TikTok', 'X (Twitter)', 'LinkedIn', 'YouTube', 'Facebook'], required: true },
    { id: 'q2', question: 'What is your current total follower count (across platforms)?', type: 'select', options: ['Under 100', '100-1K', '1K-10K', '10K-50K', '50K+'], required: true },
    { id: 'q3', question: 'What type of content do you create?', type: 'multiselect', options: ['Photos', 'Short videos', 'Long videos', 'Text posts', 'Stories', 'Live streams'], required: true },
    { id: 'q4', question: 'How often do you currently post?', type: 'select', options: ['Rarely', '1-2 times/week', '3-5 times/week', 'Daily', 'Multiple times/day'], required: true },
    { id: 'q5', question: 'What is your growth goal?', type: 'text', required: true },
    { id: 'q6', question: 'What is your niche or topic area?', type: 'text', required: true },
  ],
  milestones: ['Content strategy defined', 'First week posting consistently', 'Engagement rate baseline set', '30-day content streak', 'Follower growth milestone', 'First viral post'],
  defaultTaskTypes: ['content_creation', 'scheduling', 'engagement', 'analytics'],
  allowedActions: ['generate_post', 'schedule_content', 'analyze_engagement', 'suggest_hashtags', 'research_trends'],
  automationRules: ['auto_schedule_posts', 'weekly_analytics_report', 'trend_alerts'],
  leadingIndicators: [
    { name: 'Posts published', description: 'Content pieces published this week', unit: 'count', targetDirection: 'increase' },
    { name: 'Engagement rate', description: 'Average engagement per post', unit: '%', targetDirection: 'increase' },
    { name: 'Follower growth', description: 'Net new followers this week', unit: 'count', targetDirection: 'increase' },
  ],
};
