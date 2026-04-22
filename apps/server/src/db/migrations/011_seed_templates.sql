-- Seed goal_templates with all 9 templates from the TypeScript registry.
-- Uses stable predictable UUIDs so the seed is idempotent.

INSERT INTO public.goal_templates
  (id, name, description, category, duration_days, diagnostic_questions, milestones, allowed_actions, leading_indicators, is_active)
VALUES

-- Fitness
(
  'a1000000-0000-0000-0000-000000000001',
  'Beginner Fitness Journey',
  'Build a sustainable exercise habit from scratch over 90 days.',
  'FITNESS', 90,
  '[
    {"id":"dq-fitness-level","question":"How would you rate your current fitness level?","type":"scale","min":1,"max":5},
    {"id":"dq-fitness-days","question":"How many days per week can you commit to exercise?","type":"scale","min":1,"max":7},
    {"id":"dq-fitness-goal","question":"What is your primary fitness goal?","type":"choice","options":["Weight loss","Muscle gain","Endurance","Flexibility","General health"]},
    {"id":"dq-fitness-equipment","question":"Do you have access to a gym?","type":"boolean"}
  ]'::jsonb,
  '["First workout week","30-day streak","5K complete","90-day transformation"]'::jsonb,
  '["ACTION","HABIT","REFLECTION"]'::jsonb,
  '[]'::jsonb,
  true
),

-- Finance
(
  'a2000000-0000-0000-0000-000000000002',
  'Personal Budget Mastery',
  'Take control of your finances and build a 3-month emergency fund.',
  'FINANCE', 90,
  '[
    {"id":"dq-finance-income","question":"Do you have a stable monthly income?","type":"boolean"},
    {"id":"dq-finance-debt","question":"Do you currently have high-interest debt?","type":"boolean"},
    {"id":"dq-finance-savings","question":"What percentage of income do you currently save?","type":"scale","min":0,"max":100},
    {"id":"dq-finance-goal","question":"What is your primary financial goal?","type":"choice","options":["Emergency fund","Debt payoff","Investment","Home purchase","Retirement"]}
  ]'::jsonb,
  '["Budget created","First month tracked","Savings goal set","Emergency fund built"]'::jsonb,
  '["ACTION","HABIT","REFLECTION"]'::jsonb,
  '[]'::jsonb,
  true
),

-- Career
(
  'a3000000-0000-0000-0000-000000000003',
  'Career Pivot Blueprint',
  'Strategically transition to a new career field in 6 months.',
  'CAREER', 180,
  '[
    {"id":"dq-career-current","question":"What is your current industry?","type":"text"},
    {"id":"dq-career-target","question":"What is your target industry or role?","type":"text"},
    {"id":"dq-career-experience","question":"Years of professional experience","type":"scale","min":0,"max":30},
    {"id":"dq-career-timeline","question":"How urgently do you need to make this change?","type":"choice","options":["ASAP","Within 3 months","Within 6 months","Within a year","Exploring options"]}
  ]'::jsonb,
  '["Skills gap identified","Learning path started","Portfolio project complete","Network built","Applications sent","New role secured"]'::jsonb,
  '["ACTION","MILESTONE","SOCIAL"]'::jsonb,
  '[]'::jsonb,
  true
),

-- Creativity
(
  'a4000000-0000-0000-0000-000000000004',
  'Daily Writing Practice',
  'Develop a consistent creative writing habit and complete a first draft.',
  'CREATIVITY', 60,
  '[
    {"id":"dq-writing-experience","question":"How long have you been writing creatively?","type":"choice","options":["Never","Less than 1 year","1-3 years","3+ years"]},
    {"id":"dq-writing-daily-time","question":"How many minutes per day can you dedicate to writing?","type":"scale","min":10,"max":120},
    {"id":"dq-writing-format","question":"What format are you working on?","type":"choice","options":["Novel","Short stories","Poetry","Memoir","Screenwriting","Blog"]}
  ]'::jsonb,
  '["Day 7 streak","Outline complete","First chapter","Midpoint reached","First draft complete"]'::jsonb,
  '["HABIT","ACTION","REFLECTION"]'::jsonb,
  '[]'::jsonb,
  true
),

-- Relationships
(
  'a5000000-0000-0000-0000-000000000005',
  'Meaningful Connections',
  'Intentionally strengthen your social circle and deepen key relationships.',
  'RELATIONSHIPS', 60,
  '[
    {"id":"dq-rel-satisfaction","question":"How satisfied are you with your current social connections?","type":"scale","min":1,"max":10},
    {"id":"dq-rel-focus","question":"What area do you most want to improve?","type":"choice","options":["Romantic relationship","Friendships","Family","Professional network","Community"]},
    {"id":"dq-rel-introvert","question":"Do you consider yourself introverted?","type":"boolean"}
  ]'::jsonb,
  '["Relationship audit done","5 reconnections made","New community joined","Accountability partner found"]'::jsonb,
  '["SOCIAL","HABIT","REFLECTION"]'::jsonb,
  '[]'::jsonb,
  true
),

-- Health
(
  'a6000000-0000-0000-0000-000000000006',
  'Sleep Optimization',
  'Reset your sleep schedule and build recovery habits over 30 days.',
  'HEALTH', 30,
  '[
    {"id":"dq-sleep-hours","question":"How many hours of sleep do you currently get on average?","type":"scale","min":3,"max":12},
    {"id":"dq-sleep-issues","question":"What is your main sleep challenge?","type":"choice","options":["Falling asleep","Staying asleep","Waking too early","Irregular schedule","Quality of sleep"]},
    {"id":"dq-sleep-screen","question":"Do you use screens in the hour before bed?","type":"boolean"}
  ]'::jsonb,
  '["Baseline tracked","Bedtime routine set","Week 2 consistent","30-day optimized"]'::jsonb,
  '["HABIT","REFLECTION","ACTION"]'::jsonb,
  '[]'::jsonb,
  true
),

-- Productivity
(
  'a7000000-0000-0000-0000-000000000007',
  'Deep Work System',
  'Build a distraction-free work environment and 4-hour daily focus blocks.',
  'PRODUCTIVITY', 45,
  '[
    {"id":"dq-prod-distractions","question":"How many hours per day do you estimate you lose to distractions?","type":"scale","min":0,"max":8},
    {"id":"dq-prod-work-type","question":"What type of work requires your deepest focus?","type":"choice","options":["Writing","Coding","Analysis","Design","Learning","Strategy"]},
    {"id":"dq-prod-remote","question":"Do you work remotely?","type":"boolean"}
  ]'::jsonb,
  '["Environment designed","First deep work week","Distraction audit done","System fully running"]'::jsonb,
  '["ACTION","HABIT","REFLECTION"]'::jsonb,
  '[]'::jsonb,
  true
),

-- Business
(
  'a8000000-0000-0000-0000-000000000008',
  'Solo Business Growth',
  'Get your first clients, build revenue, and grow a sustainable solo business.',
  'BUSINESS', 90,
  '[
    {"id":"dq-biz-offer","question":"What service or product are you selling?","type":"text"},
    {"id":"dq-biz-stage","question":"Where are you in your business journey?","type":"choice","options":["Just starting out","Have an idea, no clients yet","A few clients","Growing and scaling"]},
    {"id":"dq-biz-revenue-goal","question":"What revenue goal are you aiming for in 90 days?","type":"choice","options":["$1K/mo","$5K/mo","$10K/mo","$20K+/mo"]}
  ]'::jsonb,
  '["Audit & strategy complete","First marketing campaign live","First new client from strategy","Revenue target hit"]'::jsonb,
  '["ACTION","HABIT","MILESTONE"]'::jsonb,
  '[]'::jsonb,
  true
),

-- Learning
(
  'a9000000-0000-0000-0000-000000000009',
  'Skill Acquisition Sprint',
  'Master a new skill through deliberate daily practice in 45 days.',
  'LEARNING', 45,
  '[
    {"id":"dq-learn-skill","question":"What skill do you want to learn?","type":"text"},
    {"id":"dq-learn-prior","question":"What is your prior experience level?","type":"choice","options":["Complete beginner","Some exposure","Intermediate","Advanced in related area"]},
    {"id":"dq-learn-daily-time","question":"How many minutes per day can you dedicate?","type":"scale","min":15,"max":180}
  ]'::jsonb,
  '["Fundamentals learned","First project built","Intermediate level reached","Skill demonstrated publicly"]'::jsonb,
  '["ACTION","HABIT","MILESTONE"]'::jsonb,
  '[]'::jsonb,
  true
)

ON CONFLICT (id) DO UPDATE SET
  name                 = EXCLUDED.name,
  description          = EXCLUDED.description,
  category             = EXCLUDED.category,
  duration_days        = EXCLUDED.duration_days,
  diagnostic_questions = EXCLUDED.diagnostic_questions,
  milestones           = EXCLUDED.milestones,
  allowed_actions      = EXCLUDED.allowed_actions,
  is_active            = EXCLUDED.is_active,
  updated_at           = NOW();
