import { TaskType } from '@lyfestack/shared';

export interface DiagnosticQuestion {
  id: string;
  question: string;
  type: 'text' | 'scale' | 'choice';
  options?: string[];
}

export interface TemplateMilestone {
  weekNumber: number;
  title: string;
  description: string;
}

export interface AutomationRule {
  trigger: string;
  condition?: string;
  action: string;
}

export interface TemplateDefinition {
  id: string;
  name: string;
  description: string;
  category: string;
  durationDays: number;
  diagnosticQuestions: DiagnosticQuestion[];
  milestones: TemplateMilestone[];
  allowedActions: string[];
  automationRules: AutomationRule[];
  leadingIndicators: string[];
  defaultTaskTypes: TaskType[];
}

const templates: TemplateDefinition[] = [
  {
    id: 'productivity',
    name: 'Productivity',
    description: 'Build deep work habits, eliminate distractions, and ship more of what matters.',
    category: 'productivity',
    durationDays: 90,
    diagnosticQuestions: [
      {
        id: 'pq1',
        question: 'How many hours of focused deep work do you average per day?',
        type: 'scale',
        options: ['0', '1', '2', '3', '4+'],
      },
      {
        id: 'pq2',
        question: 'What is your biggest time drain right now?',
        type: 'choice',
        options: ['Meetings', 'Social media', 'Email', 'Unclear priorities', 'Context switching'],
      },
      {
        id: 'pq3',
        question: 'What does a productive day look like for you?',
        type: 'text',
      },
    ],
    milestones: [
      { weekNumber: 1, title: 'Audit & Baseline', description: 'Track current time usage and identify top 3 distractions.' },
      { weekNumber: 3, title: 'Deep Work Routine', description: 'Establish a daily 2-hour protected deep work block.' },
      { weekNumber: 6, title: 'System Optimized', description: 'Reduce meeting time by 30% and automate recurring tasks.' },
      { weekNumber: 10, title: 'Consistent Output', description: 'Ship at least one meaningful deliverable per week for 4 consecutive weeks.' },
      { weekNumber: 13, title: 'Sustainable Pace', description: 'Maintain output with 20% less effort through refined systems.' },
    ],
    allowedActions: [
      'schedule_deep_work_block',
      'block_distraction_app',
      'decline_meeting',
      'delegate_task',
      'create_task_batch',
      'set_daily_priority',
    ],
    automationRules: [
      { trigger: 'day_start', action: 'surface_top_3_priorities' },
      { trigger: 'deep_work_block_missed', condition: 'two_consecutive_days', action: 'prompt_reschedule' },
      { trigger: 'weekly_review', action: 'generate_output_summary' },
    ],
    leadingIndicators: [
      'Deep work hours per day',
      'Tasks completed vs planned',
      'Meeting hours per week',
      'Days with a clear top priority',
      'Deliverables shipped per week',
    ],
    defaultTaskTypes: [TaskType.ACTION, TaskType.HABIT, TaskType.REFLECTION],
  },

  {
    id: 'self-improvement',
    name: 'Self Improvement',
    description: 'Develop lasting habits across mindset, learning, and personal discipline.',
    category: 'self_improvement',
    durationDays: 90,
    diagnosticQuestions: [
      {
        id: 'siq1',
        question: 'Which area of self-improvement is your top priority?',
        type: 'choice',
        options: ['Mental health', 'Learning & skills', 'Relationships', 'Financial habits', 'Mindset & resilience'],
      },
      {
        id: 'siq2',
        question: 'How consistently do you follow through on personal commitments? (1=rarely, 5=always)',
        type: 'scale',
        options: ['1', '2', '3', '4', '5'],
      },
      {
        id: 'siq3',
        question: 'What one habit, if built, would change everything for you?',
        type: 'text',
      },
    ],
    milestones: [
      { weekNumber: 1, title: 'Self Assessment', description: 'Complete values exercise and identify top growth target.' },
      { weekNumber: 3, title: 'Anchor Habit', description: 'Build one keystone habit with 21-day consistency.' },
      { weekNumber: 6, title: 'Stacked Routines', description: 'Add two habit stacks to existing anchor habit.' },
      { weekNumber: 10, title: 'Identity Shift', description: 'Journal evidence of new identity emerging across 4 weeks.' },
      { weekNumber: 13, title: 'Compound Growth', description: 'Measure progress across 3 self-improvement dimensions.' },
    ],
    allowedActions: [
      'log_habit_completion',
      'schedule_reflection',
      'add_learning_resource',
      'set_weekly_intention',
      'book_accountability_check_in',
    ],
    automationRules: [
      { trigger: 'habit_streak_broken', action: 'send_recovery_prompt' },
      { trigger: 'weekly_review', action: 'generate_growth_reflection' },
      { trigger: 'milestone_reached', action: 'celebrate_and_set_next' },
    ],
    leadingIndicators: [
      'Habit completion rate (%)',
      'Days journaled per week',
      'Learning hours per week',
      'Streak length on keystone habit',
      'Self-reported energy score (daily)',
    ],
    defaultTaskTypes: [TaskType.HABIT, TaskType.REFLECTION, TaskType.ACTION],
  },

  {
    id: 'solo-business',
    name: 'Solo Business',
    description: 'Launch or grow a one-person business from idea to consistent revenue.',
    category: 'business',
    durationDays: 90,
    diagnosticQuestions: [
      {
        id: 'sbq1',
        question: 'What stage is your solo business at?',
        type: 'choice',
        options: ['Just an idea', 'Building MVP', 'First customers', 'Growing revenue', 'Scaling systems'],
      },
      {
        id: 'sbq2',
        question: 'What is your current monthly revenue?',
        type: 'choice',
        options: ['$0', '$1-$1k', '$1k-$5k', '$5k-$10k', '$10k+'],
      },
      {
        id: 'sbq3',
        question: 'What is the single biggest obstacle to growing your business right now?',
        type: 'text',
      },
    ],
    milestones: [
      { weekNumber: 1, title: 'Offer Clarity', description: 'Define your offer, target customer, and core value proposition.' },
      { weekNumber: 3, title: 'First Outreach', description: 'Contact 20 potential customers and get 3 discovery calls booked.' },
      { weekNumber: 6, title: 'First Revenue', description: 'Close first paying customer or reach $1k MRR milestone.' },
      { weekNumber: 10, title: 'Repeatable System', description: 'Document acquisition, delivery, and follow-up processes.' },
      { weekNumber: 13, title: 'Predictable Growth', description: 'Hit revenue target and have a 30-day pipeline of leads.' },
    ],
    allowedActions: [
      'draft_outreach_message',
      'schedule_follow_up',
      'post_content',
      'log_revenue',
      'create_proposal',
      'book_discovery_call',
      'update_pipeline',
    ],
    automationRules: [
      { trigger: 'lead_no_response', condition: 'after_3_days', action: 'prompt_follow_up' },
      { trigger: 'weekly_review', action: 'generate_pipeline_summary' },
      { trigger: 'revenue_milestone_reached', action: 'celebrate_and_raise_target' },
    ],
    leadingIndicators: [
      'Outreach messages sent per week',
      'Discovery calls booked',
      'Proposals sent',
      'Monthly recurring revenue ($)',
      'Active leads in pipeline',
    ],
    defaultTaskTypes: [TaskType.ACTION, TaskType.MILESTONE, TaskType.SOCIAL],
  },

  {
    id: 'social-media',
    name: 'Social Media',
    description: 'Build an authentic audience and consistent content engine on your chosen platform.',
    category: 'social_media',
    durationDays: 90,
    diagnosticQuestions: [
      {
        id: 'smq1',
        question: 'Which platform is your primary focus?',
        type: 'choice',
        options: ['X / Twitter', 'LinkedIn', 'Instagram', 'TikTok', 'YouTube', 'Threads'],
      },
      {
        id: 'smq2',
        question: 'How often do you currently post?',
        type: 'choice',
        options: ['Never', 'Rarely (< 1/week)', '1-2x per week', '3-5x per week', 'Daily'],
      },
      {
        id: 'smq3',
        question: 'What topic or niche do you want to be known for?',
        type: 'text',
      },
    ],
    milestones: [
      { weekNumber: 1, title: 'Niche & Voice', description: 'Define content pillars, target audience, and posting schedule.' },
      { weekNumber: 3, title: 'Consistent Publisher', description: 'Post 5x per week for 2 consecutive weeks.' },
      { weekNumber: 6, title: 'First Viral Hit', description: 'Publish one piece of content that exceeds 10x average reach.' },
      { weekNumber: 10, title: 'Community Builder', description: 'Respond to every comment for 30 days and gain 500 new followers.' },
      { weekNumber: 13, title: 'Authority Position', description: 'Reach follower target and receive first inbound collaboration offer.' },
    ],
    allowedActions: [
      'draft_post',
      'schedule_post_via_buffer',
      'reply_to_comment',
      'engage_with_peer_content',
      'analyze_top_performing_post',
      'repurpose_content',
    ],
    automationRules: [
      { trigger: 'post_scheduled', action: 'confirm_via_buffer' },
      { trigger: 'posting_streak_broken', condition: 'two_consecutive_days', action: 'prompt_batch_create' },
      { trigger: 'weekly_review', action: 'generate_engagement_report' },
      { trigger: 'post_exceeds_avg_reach', action: 'flag_for_repurposing' },
    ],
    leadingIndicators: [
      'Posts published per week',
      'Follower growth per week',
      'Average engagement rate (%)',
      'Comments replied to per week',
      'Posting streak (days)',
    ],
    defaultTaskTypes: [TaskType.ACTION, TaskType.HABIT, TaskType.SOCIAL],
  },

  {
    id: 'fitness',
    name: 'Fitness',
    description: 'Build a sustainable training and nutrition foundation to reach your physique or performance goal.',
    category: 'fitness',
    durationDays: 90,
    diagnosticQuestions: [
      {
        id: 'fq1',
        question: 'What is your primary fitness goal?',
        type: 'choice',
        options: ['Lose body fat', 'Build muscle', 'Improve endurance', 'Increase strength', 'General health'],
      },
      {
        id: 'fq2',
        question: 'How many days per week do you currently exercise?',
        type: 'scale',
        options: ['0', '1', '2', '3', '4', '5+'],
      },
      {
        id: 'fq3',
        question: 'What has stopped you from reaching your fitness goals in the past?',
        type: 'text',
      },
    ],
    milestones: [
      { weekNumber: 1, title: 'Baseline Metrics', description: 'Record starting weight, measurements, and benchmark workout.' },
      { weekNumber: 3, title: 'Consistent Training', description: 'Hit all planned workouts for 2 consecutive weeks.' },
      { weekNumber: 6, title: 'Nutrition Locked', description: 'Track macros or calories for 30 consecutive days.' },
      { weekNumber: 10, title: 'Performance Marker', description: 'Improve baseline benchmark by 20% or hit an intermediate milestone.' },
      { weekNumber: 13, title: 'Sustainable Lifestyle', description: 'Reach primary goal metric and build a maintenance plan.' },
    ],
    allowedActions: [
      'log_workout',
      'log_nutrition',
      'schedule_training_session',
      'book_rest_day',
      'update_body_metrics',
      'generate_weekly_training_plan',
    ],
    automationRules: [
      { trigger: 'workout_missed', condition: 'two_consecutive_days', action: 'prompt_reschedule' },
      { trigger: 'weekly_review', action: 'generate_training_summary' },
      { trigger: 'milestone_reached', action: 'update_training_targets' },
      { trigger: 'seven_day_streak', action: 'prompt_deload_check' },
    ],
    leadingIndicators: [
      'Workouts completed per week',
      'Days nutrition tracked',
      'Average sleep hours per night',
      'Weekly body weight (lbs/kg)',
      'Training streak (days)',
    ],
    defaultTaskTypes: [TaskType.HABIT, TaskType.ACTION, TaskType.MILESTONE],
  },
];

class TemplateRegistryClass {
  private readonly index: Map<string, TemplateDefinition>;

  constructor() {
    this.index = new Map(templates.map((t) => [t.id, t]));
  }

  getAll(): TemplateDefinition[] {
    return templates;
  }

  getById(id: string): TemplateDefinition | undefined {
    return this.index.get(id);
  }
}

export const TemplateRegistry = new TemplateRegistryClass();
