import type { SupabaseClient, AuthError } from '@supabase/supabase-js';
import type { User } from '@lyfestack/shared';
import type { UserRepository } from '../repositories/user.repository';
import { AuthenticationError, ConflictError, ExternalServiceError } from '../errors/AppError';

export interface SignUpData {
  email: string;
  password: string;
  name?: string | undefined;
}

export interface SignInData {
  email: string;
  password: string;
}

export interface AuthResult {
  user: User;
  accessToken: string;
  refreshToken: string;
}

export class AuthService {
  constructor(
    private readonly supabase: SupabaseClient,
    private readonly userRepository: UserRepository,
  ) {}

  async signUp(data: SignUpData): Promise<AuthResult> {
    const { data: authData, error } = await this.supabase.auth.signUp({
      email: data.email,
      password: data.password,
      options: {
        data: { name: data.name ?? null },
      },
    });

    if (error) throw this.mapAuthError(error);
    if (!authData.user || !authData.session) {
      throw new AuthenticationError('Sign up failed — check your email for confirmation', 'SIGNUP_PENDING');
    }

    // User profile is auto-created by the DB trigger; fetch it
    const profile = await this.userRepository.findById(authData.user.id);
    if (!profile) {
      // Fallback: create manually if trigger hasn't fired yet
      await this.userRepository.create({
        id: authData.user.id,
        email: authData.user.email ?? data.email,
        name: data.name ?? null,
      });
      const created = await this.userRepository.findById(authData.user.id);
      if (!created) throw new ExternalServiceError('Database', 'Failed to create user profile');
      return this.toAuthResult(created, authData.session);
    }

    return this.toAuthResult(profile, authData.session);
  }

  async signIn(data: SignInData): Promise<AuthResult> {
    const { data: authData, error } = await this.supabase.auth.signInWithPassword({
      email: data.email,
      password: data.password,
    });

    if (error) throw this.mapAuthError(error);
    if (!authData.user || !authData.session) {
      throw new AuthenticationError('Sign in failed', 'SIGN_IN_FAILED');
    }

    const profile = await this.userRepository.findById(authData.user.id);
    if (!profile) throw new AuthenticationError('User profile not found', 'USER_NOT_FOUND');

    return this.toAuthResult(profile, authData.session);
  }

  async signOut(accessToken: string): Promise<void> {
    const { error } = await this.supabase.auth.admin.signOut(accessToken);
    if (error) throw this.mapAuthError(error);
  }

  async getMe(userId: string): Promise<User> {
    const profile = await this.userRepository.findById(userId);
    if (!profile) throw new AuthenticationError('User not found', 'USER_NOT_FOUND');
    return profile;
  }

  private toAuthResult(
    user: User,
    session: { access_token: string; refresh_token: string },
  ): AuthResult {
    return {
      user,
      accessToken: session.access_token,
      refreshToken: session.refresh_token,
    };
  }

  private mapAuthError(error: AuthError): Error {
    const msg = error.message?.toLowerCase() ?? '';
    if (msg.includes('already registered') || msg.includes('already exists')) {
      return new ConflictError('Email address is already registered', 'EMAIL_TAKEN');
    }
    if (msg.includes('invalid login') || msg.includes('invalid credentials')) {
      return new AuthenticationError('Invalid email or password', 'INVALID_CREDENTIALS');
    }
    if (msg.includes('email not confirmed')) {
      return new AuthenticationError('Email not confirmed — check your inbox', 'EMAIL_NOT_CONFIRMED');
    }
    return new ExternalServiceError('Supabase Auth', error.message);
  }
}
