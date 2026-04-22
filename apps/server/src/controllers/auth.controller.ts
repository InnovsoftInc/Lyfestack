import type { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import type { AuthService } from '../services/auth.service';
import { ValidationError } from '../errors/AppError';

const signUpSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  name: z.string().optional(),
});

const signInSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export class AuthController {
  constructor(private readonly authService: AuthService) {}

  signup = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const parsed = signUpSchema.safeParse(req.body);
    if (!parsed.success) {
      return next(new ValidationError(parsed.error.issues[0]?.message ?? 'Invalid input'));
    }

    try {
      const result = await this.authService.signUp(parsed.data);
      if ('confirmationRequired' in result) {
        res.status(202).json({ data: result });
      } else {
        res.status(201).json({ data: result });
      }
    } catch (err) {
      next(err);
    }
  };

  login = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const parsed = signInSchema.safeParse(req.body);
    if (!parsed.success) {
      return next(new ValidationError(parsed.error.issues[0]?.message ?? 'Invalid input'));
    }

    try {
      const result = await this.authService.signIn(parsed.data);
      res.status(200).json({ data: result });
    } catch (err) {
      next(err);
    }
  };

  logout = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const token = req.headers.authorization?.slice(7) ?? '';
    try {
      await this.authService.signOut(token);
      res.status(204).send();
    } catch (err) {
      next(err);
    }
  };

  me = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    if (!req.user) {
      return next(new ValidationError('User context missing'));
    }
    try {
      const user = await this.authService.getMe(req.user.id);
      res.status(200).json({ data: user });
    } catch (err) {
      next(err);
    }
  };
}
