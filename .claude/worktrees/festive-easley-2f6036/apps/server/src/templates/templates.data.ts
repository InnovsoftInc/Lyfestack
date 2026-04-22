export interface DiagnosticQuestion {
  id: string;
  question: string;
  type: 'text' | 'number' | 'select' | 'multiselect';
  options?: string[];
  placeholder?: string;
}

export interface TemplateMilestone {
  title: string;
  weekNumber: number;
  description: string;
}

export interface AutomationRule {
  trigger: string;
  action: string;
  description: string;
}

export interface FullGoalTemplate {
  id: string;
  name: string;
  description: string;
  category: 'productivity' | 'self-improvement' | 'solo-business' | 'social-media' | 'fitness';
  durationWeeks: number;
  diagnosticQuestions: DiagnosticQuestion[];
  milestones: TemplateMilestone[];
  allowedActions: string[];
  automationRules: AutomationRule[];
  leadingIndicators: string[];
}

export const GOAL_TEMPLATES: FullGoalTemplate[] = [
  {
    id: 'tpl_productivity',
    name: 'Productivity',
    description: 'Build deep work habits, eliminate distractions, and ship more in less time.',
    category: 'productivity',
    durationWeeks: 8,
    diagnosticQuestions: [
      {
        id: 'q_time_waster',
        question: "What's your biggest time waster?",
        type: 'select',
        options: ['Social media', 'Meetings', 'Email', 'Procrastination', 'Interruptions', 'Other'],
      },
      {
        id: 'q_focus_hours',
        question: 'How many hours per day can you dedicate to focused work?',
        type: 'number',
        placeholder: 'e.g. 3',
      },
      {
        id: 'q_tools',
        question: 'What productivity tools do you currently use?',
        type: 'multiselect',
        options: ['Notion', 'Todoist', 'Obsidian', 'Linear', 'Trello', 'None', 'Other'],
      },
      {
        id: 'q_biggest_project',
        question: "What's the one project that would make this year a success if completed?",
        type: 'text',
        placeholder: 'e.g. Launch my SaaS MVP',
      },
      {
        id: 'q_work_style',
        question: 'Do you work better in long blocks or short bursts?',
        type: 'select',
        options: ['Long blocks (90+ min)', 'Short bursts (25 min pomodoros)', 'Varies by task'],
      },
    ],
    milestones: [
      { title: 'Audit complete', weekNumber: 1, description: 'Time audit done, top 3 wasters identified' },
      { title: 'System in place', weekNumber: 3, description: 'Daily shutdown ritual + planning system adopted' },
      { title: 'Deep work habit', weekNumber: 5, description: '4+ hours of deep work logged for 5 consecutive days' },
      { title: 'Project shipped', weekNumber: 8, description: 'Primary project milestone reached' },
    ],
    allowedActions: [
      'schedule_focus_block',
      'block_distracting_apps',
      'create_task',
      'mark_task_complete',
      'generate_weekly_review',
    ],
    automationRules: [
      { trigger: 'morning', action: 'generate_daily_brief', description: 'Generate priority task list each morning' },
      { trigger: 'task_overdue_24h', action: 'reschedule_task', description: 'Auto-reschedule missed tasks' },
      { trigger: 'weekly_friday', action: 'generate_weekly_review', description: 'Weekly progress summary' },
    ],
    leadingIndicators: [
      'Hours of deep work per day',
      'Tasks completed per week',
      'Time to first deep work block after waking',
      'Weekly project progress %',
    ],
  },
  {
    id: 'tpl_self_improvement',
    name: 'Self Improvement',
    description: 'Build powerful habits around mindset, learning, and personal growth.',
    category: 'self-improvement',
    durationWeeks: 12,
    diagnosticQuestions: [
      {
        id: 'q_habits_current',
        question: 'Which habits do you currently practice?',
        type: 'multiselect',
        options: ['Morning routine', 'Meditation', 'Journaling', 'Reading', 'Exercise', 'Cold shower', 'None'],
      },
      {
        id: 'q_reading_goal',
        question: 'How many books do you want to read this year?',
        type: 'number',
        placeholder: 'e.g. 12',
      },
      {
        id: 'q_meditation',
        question: 'Have you tried meditation before?',
        type: 'select',
        options: ['Never', 'Tried but stopped', 'Occasional practice', 'Daily practice'],
      },
      {
        id: 'q_journaling',
        question: 'What does journaling mean to you?',
        type: 'select',
        options: ['Gratitude log', 'Brain dump', 'Goal tracking', 'Reflection', 'Never tried'],
      },
      {
        id: 'q_growth_area',
        question: "What's the one area of your life you most want to improve?",
        type: 'select',
        options: ['Mental clarity', 'Emotional regulation', 'Discipline', 'Confidence', 'Relationships', 'Spirituality'],
      },
    ],
    milestones: [
      { title: 'Habit stack defined', weekNumber: 1, description: 'Morning routine designed and committed to' },
      { title: '21-day streak', weekNumber: 3, description: 'Core habit maintained for 21 consecutive days' },
      { title: 'First book done', weekNumber: 4, description: 'First book finished and notes captured' },
      { title: 'Reflection system', weekNumber: 8, description: 'Weekly reflection ritual established' },
      { title: 'Identity shift', weekNumber: 12, description: 'New habits feel automatic — identity update confirmed' },
    ],
    allowedActions: [
      'log_habit_completion',
      'create_journal_prompt',
      'recommend_book',
      'schedule_meditation',
      'generate_weekly_reflection',
    ],
    automationRules: [
      { trigger: 'morning', action: 'send_habit_checklist', description: 'Morning habit checklist reminder' },
      { trigger: 'habit_missed_3_days', action: 'send_coaching_message', description: 'Re-engagement nudge after 3 missed days' },
      { trigger: 'weekly_sunday', action: 'generate_journal_prompt', description: 'Weekly reflection prompt' },
    ],
    leadingIndicators: [
      'Habit completion rate %',
      'Meditation streak (days)',
      'Books read this month',
      'Journal entries per week',
    ],
  },
  {
    id: 'tpl_solo_business',
    name: 'Solo Business',
    description: 'Build and grow a one-person business — from idea validation to consistent revenue.',
    category: 'solo-business',
    durationWeeks: 16,
    diagnosticQuestions: [
      {
        id: 'q_business_type',
        question: 'What type of solo business are you building?',
        type: 'select',
        options: ['Freelance / Consulting', 'SaaS / Software', 'Content / Creator', 'E-commerce', 'Coaching / Courses', 'Agency'],
      },
      {
        id: 'q_revenue',
        question: 'What is your current monthly revenue (USD)?',
        type: 'number',
        placeholder: 'e.g. 0 or 2500',
      },
      {
        id: 'q_bottleneck',
        question: "What's your biggest bottleneck right now?",
        type: 'select',
        options: ['Getting leads', 'Closing sales', 'Delivering the work', 'Marketing / Visibility', 'Product-market fit', 'Time management'],
      },
      {
        id: 'q_marketing_channels',
        question: 'Which marketing channels do you currently use?',
        type: 'multiselect',
        options: ['Twitter/X', 'LinkedIn', 'Cold outreach', 'SEO/Content', 'Referrals', 'Ads', 'None'],
      },
      {
        id: 'q_revenue_target',
        question: 'What monthly revenue target are you aiming for in 90 days?',
        type: 'number',
        placeholder: 'e.g. 5000',
      },
    ],
    milestones: [
      { title: 'Offer defined', weekNumber: 2, description: 'Clear, specific offer documented with pricing' },
      { title: 'First lead', weekNumber: 4, description: 'First qualified prospect in pipeline' },
      { title: 'First paying client', weekNumber: 6, description: 'First revenue generated' },
      { title: 'Repeatable system', weekNumber: 10, description: 'Lead gen → close → deliver documented as process' },
      { title: 'Revenue target hit', weekNumber: 16, description: 'Monthly revenue target reached' },
    ],
    allowedActions: [
      'draft_outreach_email',
      'create_content_post',
      'analyze_metrics',
      'generate_proposal',
      'schedule_follow_up',
      'research_competitors',
    ],
    automationRules: [
      { trigger: 'daily', action: 'generate_outreach_tasks', description: 'Daily outreach task generation' },
      { trigger: 'lead_no_reply_3days', action: 'draft_followup', description: 'Auto-draft follow-up for cold leads' },
      { trigger: 'weekly_monday', action: 'generate_pipeline_review', description: 'Weekly pipeline health check' },
    ],
    leadingIndicators: [
      'Outreach messages sent per week',
      'Leads in pipeline',
      'Revenue this month (USD)',
      'Conversion rate (leads → clients)',
    ],
  },
  {
    id: 'tpl_social_media',
    name: 'Social Media Growth',
    description: 'Grow a meaningful audience and turn it into real business outcomes.',
    category: 'social-media',
    durationWeeks: 12,
    diagnosticQuestions: [
      {
        id: 'q_platforms',
        question: 'Which platforms are you focused on?',
        type: 'multiselect',
        options: ['Twitter/X', 'LinkedIn', 'Instagram', 'TikTok', 'YouTube', 'Threads', 'Bluesky'],
      },
      {
        id: 'q_follower_count',
        question: 'What is your current combined follower count?',
        type: 'number',
        placeholder: 'e.g. 500',
      },
      {
        id: 'q_content_type',
        question: 'What type of content do you create?',
        type: 'multiselect',
        options: ['Short-form text', 'Long-form essays', 'Short video (Reels/Shorts)', 'Long video', 'Carousels', 'Podcasts', 'Memes'],
      },
      {
        id: 'q_posting_frequency',
        question: 'How often do you currently post?',
        type: 'select',
        options: ['Rarely / Never', 'A few times a month', '1-2x per week', '3-5x per week', 'Daily'],
      },
      {
        id: 'q_growth_goal',
        question: 'What follower count do you want to reach in 90 days?',
        type: 'number',
        placeholder: 'e.g. 5000',
      },
    ],
    milestones: [
      { title: 'Content pillars defined', weekNumber: 1, description: '3-5 content themes documented' },
      { title: 'Posting consistency', weekNumber: 3, description: 'Posted on schedule for 3 weeks straight' },
      { title: 'First viral post', weekNumber: 5, description: 'At least one post reaches 10x average reach' },
      { title: '50% growth milestone', weekNumber: 8, description: 'Halfway to follower target' },
      { title: 'Growth target hit', weekNumber: 12, description: 'Target follower count reached' },
    ],
    allowedActions: [
      'generate_post_ideas',
      'draft_social_post',
      'schedule_post',
      'analyze_top_performing_posts',
      'suggest_hashtags',
      'repurpose_content',
    ],
    automationRules: [
      { trigger: 'daily', action: 'generate_post_ideas', description: '3 fresh post ideas every morning' },
      { trigger: 'post_scheduled', action: 'suggest_engage_strategy', description: 'Engagement tips after scheduling' },
      { trigger: 'weekly', action: 'analyze_best_performing_content', description: 'Weekly content performance report' },
    ],
    leadingIndicators: [
      'Posts published per week',
      'Avg engagement rate %',
      'Follower growth per week',
      'Profile visits per week',
    ],
  },
  {
    id: 'tpl_fitness',
    name: 'Fitness',
    description: 'Build a sustainable fitness routine tailored to your goals and schedule.',
    category: 'fitness',
    durationWeeks: 12,
    diagnosticQuestions: [
      {
        id: 'q_fitness_level',
        question: 'How would you describe your current fitness level?',
        type: 'select',
        options: ['Sedentary (rarely active)', 'Light (1-2x/week)', 'Moderate (3x/week)', 'Active (4-5x/week)', 'Athlete (6x+/week)'],
      },
      {
        id: 'q_fitness_goal',
        question: 'What is your primary fitness goal?',
        type: 'select',
        options: ['Lose weight / fat loss', 'Build muscle / gain strength', 'Improve endurance / cardio', 'Increase flexibility', 'General health & energy'],
      },
      {
        id: 'q_equipment',
        question: 'What equipment do you have access to?',
        type: 'multiselect',
        options: ['Full gym', 'Home gym', 'Dumbbells only', 'Resistance bands', 'Bodyweight only', 'Pool', 'Bike / outdoor'],
      },
      {
        id: 'q_workout_days',
        question: 'How many days per week can you realistically work out?',
        type: 'number',
        placeholder: 'e.g. 4',
      },
      {
        id: 'q_injuries',
        question: 'Do you have any injuries or limitations to be aware of?',
        type: 'text',
        placeholder: 'e.g. bad knees, lower back — or type "none"',
      },
    ],
    milestones: [
      { title: 'Program started', weekNumber: 1, description: 'First week of workouts completed as planned' },
      { title: 'Habit locked in', weekNumber: 3, description: 'Missed 0 planned workouts for 2 consecutive weeks' },
      { title: 'First benchmark PR', weekNumber: 5, description: 'Personal record on a key exercise or metric' },
      { title: 'Halfway results', weekNumber: 6, description: 'Progress check: measurements / photos / weight' },
      { title: 'Goal achieved', weekNumber: 12, description: 'Primary fitness goal reached or within 10%' },
    ],
    allowedActions: [
      'generate_workout_plan',
      'log_workout',
      'adjust_workout_difficulty',
      'log_nutrition',
      'schedule_rest_day',
      'generate_progress_report',
    ],
    automationRules: [
      { trigger: 'scheduled_workout_day', action: 'send_workout_reminder', description: 'Pre-workout motivation message' },
      { trigger: 'workout_missed_twice', action: 'adjust_schedule', description: 'Offer easier schedule after 2 misses' },
      { trigger: 'weekly', action: 'generate_progress_report', description: 'Weekly stats and encouragement' },
    ],
    leadingIndicators: [
      'Workouts completed per week',
      'Workout consistency % (vs planned)',
      'Progressive overload trend (weight/reps)',
      'Resting heart rate (if tracked)',
    ],
  },
];
