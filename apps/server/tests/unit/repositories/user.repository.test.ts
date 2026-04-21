import { UserRepository } from '../../../src/repositories/user.repository';
import { TrustTier } from '@lyfestack/shared';
import { makeUserRow } from '../../fixtures/supabase.mock';

// ─── Mock Supabase client ────────────────────────────────────────────────────

function makeSingleQueryMock(result: { data?: unknown; error?: unknown }) {
  const builder = {
    select: jest.fn().mockReturnThis(),
    eq:     jest.fn().mockReturnThis(),
    in:     jest.fn().mockReturnThis(),
    single: jest.fn().mockResolvedValue(result),
    limit:  jest.fn().mockReturnThis(),
    range:  jest.fn().mockReturnThis(),
    order:  jest.fn().mockReturnThis(),
    insert: jest.fn().mockReturnThis(),
    update: jest.fn().mockReturnThis(),
    delete: jest.fn().mockResolvedValue(result),
  };
  return builder;
}

function makeListQueryMock(result: { data?: unknown; error?: unknown }) {
  const builder = {
    select: jest.fn().mockReturnThis(),
    eq:     jest.fn().mockReturnThis(),
    in:     jest.fn().mockResolvedValue(result),
    single: jest.fn().mockResolvedValue(result),
    limit:  jest.fn().mockReturnThis(),
    range:  jest.fn().mockResolvedValue(result),
    order:  jest.fn().mockReturnThis(),
    insert: jest.fn().mockReturnThis(),
    update: jest.fn().mockReturnThis(),
    delete: jest.fn().mockResolvedValue(result),
  };
  // Make the builder itself awaitable (for findAll which doesn't call .single())
  (builder as unknown as Promise<unknown> & typeof builder).then = (resolve: (v: unknown) => unknown) =>
    Promise.resolve(result).then(resolve);
  return builder;
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('UserRepository', () => {
  describe('findById', () => {
    it('returns a mapped User when found', async () => {
      const row = makeUserRow();
      const builder = makeSingleQueryMock({ data: row, error: null });
      const client = { from: jest.fn().mockReturnValue(builder) } as any;
      const repo = new UserRepository(client);

      const user = await repo.findById('user-123');

      expect(user).not.toBeNull();
      expect(user!.id).toBe('user-123');
      expect(user!.email).toBe('test@example.com');
      expect(user!.displayName).toBe('Test User');
      expect(user!.timezone).toBe('America/New_York');
      expect(user!.trustTier).toBe(TrustTier.MANUAL);
    });

    it('returns null when PGRST116 (not found)', async () => {
      const builder = makeSingleQueryMock({ data: null, error: { code: 'PGRST116' } });
      const client = { from: jest.fn().mockReturnValue(builder) } as any;
      const repo = new UserRepository(client);

      const user = await repo.findById('nonexistent');

      expect(user).toBeNull();
    });

    it('throws on unexpected Supabase error', async () => {
      const builder = makeSingleQueryMock({ data: null, error: { code: 'PGRST500', message: 'DB error' } });
      const client = { from: jest.fn().mockReturnValue(builder) } as any;
      const repo = new UserRepository(client);

      await expect(repo.findById('user-123')).rejects.toMatchObject({ code: 'PGRST500' });
    });
  });

  describe('findByEmail', () => {
    it('returns a User when email matches', async () => {
      const row = makeUserRow({ email: 'hello@example.com' });
      const builder = makeSingleQueryMock({ data: row, error: null });
      const client = { from: jest.fn().mockReturnValue(builder) } as any;
      const repo = new UserRepository(client);

      const user = await repo.findByEmail('hello@example.com');

      expect(user).not.toBeNull();
      expect(user!.email).toBe('hello@example.com');
    });

    it('returns null when email not found', async () => {
      const builder = makeSingleQueryMock({ data: null, error: { code: 'PGRST116' } });
      const client = { from: jest.fn().mockReturnValue(builder) } as any;
      const repo = new UserRepository(client);

      expect(await repo.findByEmail('nobody@example.com')).toBeNull();
    });
  });

  describe('create', () => {
    it('inserts and returns mapped User', async () => {
      const row = makeUserRow();
      const builder = makeSingleQueryMock({ data: row, error: null });
      const client = { from: jest.fn().mockReturnValue(builder) } as any;
      const repo = new UserRepository(client);

      const user = await repo.create({
        id: 'user-123',
        email: 'test@example.com',
        name: 'Test User',
      });

      expect(user.id).toBe('user-123');
      expect(builder.insert).toHaveBeenCalledWith(
        expect.objectContaining({ email: 'test@example.com' }),
      );
    });
  });

  describe('updateTrustTier', () => {
    it('calls update with the correct trust_tier value', async () => {
      const row = makeUserRow({ trust_tier: 'ASSISTED' });
      const builder = makeSingleQueryMock({ data: row, error: null });
      const client = { from: jest.fn().mockReturnValue(builder) } as any;
      const repo = new UserRepository(client);

      const user = await repo.updateTrustTier('user-123', TrustTier.ASSISTED);

      expect(user).not.toBeNull();
      expect(builder.update).toHaveBeenCalledWith(
        expect.objectContaining({ trust_tier: TrustTier.ASSISTED }),
      );
    });
  });

  describe('mapRow', () => {
    it('maps null name to empty displayName', async () => {
      const row = makeUserRow({ name: null });
      const builder = makeSingleQueryMock({ data: row, error: null });
      const client = { from: jest.fn().mockReturnValue(builder) } as any;
      const repo = new UserRepository(client);

      const user = await repo.findById('user-123');
      expect(user!.displayName).toBe('');
    });

    it('maps null avatar_url to undefined avatarUrl', async () => {
      const row = makeUserRow({ avatar_url: null });
      const builder = makeSingleQueryMock({ data: row, error: null });
      const client = { from: jest.fn().mockReturnValue(builder) } as any;
      const repo = new UserRepository(client);

      const user = await repo.findById('user-123');
      expect(user!.avatarUrl).toBeUndefined();
    });
  });
});
