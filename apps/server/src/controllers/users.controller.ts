import type { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { getSupabaseClient } from '../config/database';
import { UserRepository } from '../repositories/user.repository';
import { ValidationError } from '../errors/AppError';

const savePushTokenSchema = z.object({
  pushToken: z.string().min(1),
});

export async function savePushToken(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const parsed = savePushTokenSchema.safeParse(req.body);
    if (!parsed.success) {
      return next(new ValidationError('pushToken is required'));
    }

    const userId = req.user!.id;
    const supabase = getSupabaseClient();
    const userRepo = new UserRepository(supabase);

    await userRepo.updateProfile(userId, { push_token: parsed.data.pushToken });

    res.json({ success: true });
  } catch (err) {
    next(err);
  }
}
