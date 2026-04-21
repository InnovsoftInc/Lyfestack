import type { SupabaseClient } from '@supabase/supabase-js';

type QueryBuilderMock = {
  select: jest.Mock;
  eq: jest.Mock;
  in: jest.Mock;
  single: jest.Mock;
  limit: jest.Mock;
  range: jest.Mock;
  order: jest.Mock;
  insert: jest.Mock;
  update: jest.Mock;
  delete: jest.Mock;
};

function makeQueryBuilder(result: { data?: unknown; error?: unknown; count?: number }): QueryBuilderMock {
  const builder: QueryBuilderMock = {
    select: jest.fn().mockReturnThis(),
    eq:     jest.fn().mockReturnThis(),
    in:     jest.fn().mockReturnThis(),
    limit:  jest.fn().mockReturnThis(),
    range:  jest.fn().mockReturnThis(),
    order:  jest.fn().mockReturnThis(),
    insert: jest.fn().mockReturnThis(),
    update: jest.fn().mockReturnThis(),
    delete: jest.fn().mockResolvedValue(result),
    single: jest.fn().mockResolvedValue(result),
  };
  // Make chained calls resolve to result when awaited
  Object.keys(builder).forEach((key) => {
    const fn = builder[key as keyof QueryBuilderMock];
    (fn as jest.Mock).mockImplementation((..._args: unknown[]) => ({
      ...builder,
      then: (resolve: (v: unknown) => unknown) => Promise.resolve(result).then(resolve),
    }));
  });
  builder.single.mockResolvedValue(result);
  return builder;
}

export function createMockSupabaseClient(
  defaultResult: { data?: unknown; error?: unknown; count?: number } = { data: null, error: null },
): jest.Mocked<Pick<SupabaseClient, 'from' | 'auth'>> {
  const queryBuilder = makeQueryBuilder(defaultResult);

  return {
    from: jest.fn().mockReturnValue(queryBuilder),
    auth: {
      getUser: jest.fn(),
      signUp: jest.fn(),
      signInWithPassword: jest.fn(),
      signOut: jest.fn(),
    } as unknown as SupabaseClient['auth'],
  };
}

export function makeUserRow(overrides: Partial<Record<string, unknown>> = {}): Record<string, unknown> {
  return {
    id: 'user-123',
    email: 'test@example.com',
    name: 'Test User',
    avatar_url: null,
    timezone: 'America/New_York',
    trust_tier: 'MANUAL',
    engagement_velocity: 0,
    adaptive_task_cap: 5,
    created_at: '2026-01-01T00:00:00.000Z',
    updated_at: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}
