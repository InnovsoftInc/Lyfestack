import type { Task, Goal, DailyBrief, AgentAction, User } from '@lyfestack/shared';
import { TaskStatus, TaskType, ApprovalState, GoalStatus, AgentRole, TrustTier } from '@lyfestack/shared';

const now = new Date().toISOString();
const today = new Date().toISOString().split('T')[0];

export const mockUser: User = {
  id: 'user-1',
  email: 'alex@example.com',
  displayName: 'Alex',
  timezone: 'America/New_York',
  trustTier: TrustTier.ASSISTED,
  onboardingCompleted: true,
  createdAt: now,
  updatedAt: now,
};

export type MockTask = Task & { confidence: number };

export const mockTasks: MockTask[] = [
  {
    id: 'task-1',
    goalId: 'goal-1',
    userId: 'user-1',
    title: 'Write 3 LinkedIn posts',
    description: 'Create content for the week focusing on productivity tips and personal growth stories.',
    type: TaskType.ACTION,
    status: TaskStatus.PENDING_APPROVAL,
    approvalState: ApprovalState.PENDING,
    scheduledFor: today,
    durationMinutes: 45,
    confidence: 87,
    createdAt: now,
    updatedAt: now,
  },
  {
    id: 'task-2',
    goalId: 'goal-3',
    userId: 'user-1',
    title: 'Morning workout — 30 min strength',
    description: 'Upper body strength training to build consistency toward your 5K goal.',
    type: TaskType.HABIT,
    status: TaskStatus.PENDING,
    approvalState: ApprovalState.APPROVED,
    scheduledFor: today,
    durationMinutes: 30,
    confidence: 95,
    createdAt: now,
    updatedAt: now,
  },
  {
    id: 'task-3',
    goalId: 'goal-2',
    userId: 'user-1',
    title: 'Review Q2 pricing strategy',
    description: 'Analyze competitor pricing and update consulting service tiers based on market research.',
    type: TaskType.ACTION,
    status: TaskStatus.PENDING_APPROVAL,
    approvalState: ApprovalState.PENDING,
    scheduledFor: today,
    durationMinutes: 60,
    confidence: 72,
    createdAt: now,
    updatedAt: now,
  },
];

export const mockGoals: Goal[] = [
  {
    id: 'goal-1',
    userId: 'user-1',
    title: 'Build Social Media Presence',
    description: 'Grow LinkedIn to 5,000 followers and establish thought leadership in productivity.',
    status: GoalStatus.ACTIVE,
    progressScore: 42,
    targetDate: '2026-07-01',
    milestones: [
      { id: 'm1', goalId: 'goal-1', title: '1,000 followers', dueDate: '2026-05-01', completedAt: '2026-04-10' },
      { id: 'm2', goalId: 'goal-1', title: '2,500 followers', dueDate: '2026-06-01' },
      { id: 'm3', goalId: 'goal-1', title: '5,000 followers', dueDate: '2026-07-01' },
    ],
    createdAt: now,
    updatedAt: now,
  },
  {
    id: 'goal-2',
    userId: 'user-1',
    title: 'Launch Solo Consulting Business',
    description: 'Get first 3 paying clients for strategy consulting services.',
    status: GoalStatus.ACTIVE,
    progressScore: 28,
    targetDate: '2026-06-15',
    milestones: [
      { id: 'm4', goalId: 'goal-2', title: 'Build portfolio site', dueDate: '2026-04-30' },
      { id: 'm5', goalId: 'goal-2', title: 'First discovery call', dueDate: '2026-05-15' },
      { id: 'm6', goalId: 'goal-2', title: 'First paying client', dueDate: '2026-06-01' },
    ],
    createdAt: now,
    updatedAt: now,
  },
  {
    id: 'goal-3',
    userId: 'user-1',
    title: 'Fitness & Morning Routine',
    description: 'Run a 5K and establish a consistent morning wellness routine.',
    status: GoalStatus.ACTIVE,
    progressScore: 65,
    targetDate: '2026-05-31',
    milestones: [
      { id: 'm7', goalId: 'goal-3', title: 'Run 2K without stopping', dueDate: '2026-04-15', completedAt: '2026-04-12' },
      { id: 'm8', goalId: 'goal-3', title: 'Run 5K', dueDate: '2026-05-31' },
    ],
    createdAt: now,
    updatedAt: now,
  },
];

export const mockBrief: DailyBrief = {
  id: 'brief-1',
  userId: 'user-1',
  date: today,
  greeting: 'Good morning, Alex',
  summary: "You have 3 tasks today. Focus on your content creation — you're 3 posts away from your weekly goal.",
  tasks: mockTasks,
  insights: [
    'Your engagement rate is up 12% this week',
    'Best posting window: 9–10am based on your audience',
    'Streak on track — 7 days strong',
  ],
  generatedAt: now,
};

export type MockAgentAction = AgentAction & { confidence: number };

export const mockAgentActions: MockAgentAction[] = [
  {
    id: 'action-1',
    agentRole: AgentRole.EXECUTOR,
    userId: 'user-1',
    action: 'DRAFT_CONTENT',
    payload: {
      postText:
        "The secret to building habits isn't motivation — it's removing friction. I spent 90 days testing this and here's what I found...",
      platform: 'LinkedIn',
    },
    approvalState: ApprovalState.PENDING,
    rationale:
      'Based on your top-performing posts, engagement peaks with personal story hooks. This draft scored 87% confidence.',
    confidence: 87,
    createdAt: now,
  },
  {
    id: 'action-2',
    agentRole: AgentRole.PLANNER,
    userId: 'user-1',
    action: 'UPDATE_PRICING',
    payload: {
      oldPrice: '$2,500',
      newPrice: '$3,200',
      service: 'Strategy Consulting (90-day)',
    },
    approvalState: ApprovalState.PENDING,
    rationale:
      'Market analysis shows competitors charging $3,000–$4,500 for equivalent packages. Raising to $3,200 increases monthly revenue ~28%.',
    confidence: 72,
    createdAt: now,
  },
  {
    id: 'action-3',
    agentRole: AgentRole.REVIEWER,
    userId: 'user-1',
    action: 'SCHEDULE_POST',
    payload: {
      scheduledTime: '2026-04-23T14:00:00Z',
      platform: 'LinkedIn',
      title: 'Productivity habits post',
    },
    approvalState: ApprovalState.APPROVED,
    rationale: 'Scheduled for optimal engagement window (2pm) based on 60-day audience activity data.',
    confidence: 95,
    createdAt: now,
    resolvedAt: now,
  },
];

export const MOCK_STREAK = 7;
export const MOCK_COMPLETION_RATE = 0.73;
