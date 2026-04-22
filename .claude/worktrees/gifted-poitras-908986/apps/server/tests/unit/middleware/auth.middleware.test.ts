import type { Request, Response, NextFunction } from 'express';
import { createAuthMiddleware, createOptionalAuthMiddleware, requireAuth } from '../../../src/middleware/auth.middleware';
import { AuthenticationError } from '../../../src/errors/AppError';

function makeReq(authHeader?: string): Partial<Request> {
  return {
    headers: authHeader ? { authorization: authHeader } : {},
    user: undefined,
  };
}

function makeNext(): jest.Mock<void, [unknown?]> {
  return jest.fn();
}

describe('createAuthMiddleware', () => {
  const mockUser = { id: 'user-1', email: 'test@example.com', role: 'authenticated' };

  function makeSupabase(authResult: { data: { user: typeof mockUser | null }; error: null | { message: string } }) {
    return { auth: { getUser: jest.fn().mockResolvedValue(authResult) } } as any;
  }

  it('populates req.user and calls next() for valid token', async () => {
    const supabase = makeSupabase({ data: { user: mockUser }, error: null });
    const middleware = createAuthMiddleware(supabase);
    const req = makeReq('Bearer valid-token') as Request;
    const next = makeNext();

    await middleware(req, {} as Response, next);

    expect(next).toHaveBeenCalledWith();
    expect(req.user).toEqual({ id: 'user-1', email: 'test@example.com', role: 'authenticated' });
  });

  it('calls next(AuthenticationError AUTHENTICATION_REQUIRED) when no token', async () => {
    const supabase = makeSupabase({ data: { user: null }, error: null });
    const middleware = createAuthMiddleware(supabase);
    const req = makeReq() as Request;
    const next = makeNext();

    await middleware(req, {} as Response, next);

    expect(next).toHaveBeenCalledWith(expect.any(AuthenticationError));
    const err = next.mock.calls[0]?.[0] as AuthenticationError;
    expect(err.code).toBe('AUTHENTICATION_REQUIRED');
  });

  it('calls next(AuthenticationError TOKEN_EXPIRED) for expired token', async () => {
    const supabase = makeSupabase({ data: { user: null }, error: { message: 'JWT expired' } });
    const middleware = createAuthMiddleware(supabase);
    const req = makeReq('Bearer expired-token') as Request;
    const next = makeNext();

    await middleware(req, {} as Response, next);

    expect(next).toHaveBeenCalledWith(expect.any(AuthenticationError));
    const err = next.mock.calls[0]?.[0] as AuthenticationError;
    expect(err.code).toBe('TOKEN_EXPIRED');
  });

  it('calls next(AuthenticationError INVALID_TOKEN) for malformed token', async () => {
    const supabase = makeSupabase({ data: { user: null }, error: { message: 'invalid signature' } });
    const middleware = createAuthMiddleware(supabase);
    const req = makeReq('Bearer bad-token') as Request;
    const next = makeNext();

    await middleware(req, {} as Response, next);

    expect(next).toHaveBeenCalledWith(expect.any(AuthenticationError));
    const err = next.mock.calls[0]?.[0] as AuthenticationError;
    expect(err.code).toBe('INVALID_TOKEN');
  });

  it('calls next(INVALID_TOKEN) when getUser returns null user with no error', async () => {
    const supabase = makeSupabase({ data: { user: null }, error: null });
    const middleware = createAuthMiddleware(supabase);
    const req = makeReq('Bearer some-token') as Request;
    const next = makeNext();

    await middleware(req, {} as Response, next);

    const err = next.mock.calls[0]?.[0] as AuthenticationError;
    expect(err.code).toBe('INVALID_TOKEN');
  });
});

describe('createOptionalAuthMiddleware', () => {
  it('passes through with no token, req.user stays undefined', async () => {
    const supabase = { auth: { getUser: jest.fn() } } as any;
    const middleware = createOptionalAuthMiddleware(supabase);
    const req = makeReq() as Request;
    const next = makeNext();

    await middleware(req, {} as Response, next);

    expect(next).toHaveBeenCalledWith();
    expect(req.user).toBeUndefined();
    expect(supabase.auth.getUser).not.toHaveBeenCalled();
  });

  it('populates req.user when valid token is present', async () => {
    const supabase = {
      auth: {
        getUser: jest.fn().mockResolvedValue({
          data: { user: { id: 'u1', email: 'a@b.com', role: 'authenticated' } },
        }),
      },
    } as any;
    const middleware = createOptionalAuthMiddleware(supabase);
    const req = makeReq('Bearer ok-token') as Request;
    const next = makeNext();

    await middleware(req, {} as Response, next);

    expect(next).toHaveBeenCalledWith();
    expect(req.user?.id).toBe('u1');
  });

  it('still calls next() when token verification throws', async () => {
    const supabase = { auth: { getUser: jest.fn().mockRejectedValue(new Error('network')) } } as any;
    const middleware = createOptionalAuthMiddleware(supabase);
    const req = makeReq('Bearer bad-token') as Request;
    const next = makeNext();

    await middleware(req, {} as Response, next);

    expect(next).toHaveBeenCalledWith();
    expect(req.user).toBeUndefined();
  });
});

describe('requireAuth', () => {
  it('calls next() when req.user is set', () => {
    const req = { user: { id: 'u1', email: 'a@b.com', role: 'authenticated' } } as Request;
    const next = makeNext();

    requireAuth(req, {} as Response, next);

    expect(next).toHaveBeenCalledWith();
  });

  it('calls next(AuthenticationError) when req.user is undefined', () => {
    const req = { user: undefined } as Request;
    const next = makeNext();

    requireAuth(req, {} as Response, next);

    expect(next).toHaveBeenCalledWith(expect.any(AuthenticationError));
    const err = next.mock.calls[0]?.[0] as AuthenticationError;
    expect(err.code).toBe('AUTHENTICATION_REQUIRED');
    expect(err.statusCode).toBe(401);
  });
});
