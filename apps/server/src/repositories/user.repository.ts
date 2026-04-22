import type { User } from '@lyfestack/shared';
import { BaseRepository } from './base.repository';

export class UserRepository extends BaseRepository<User> {
  protected table = 'users';

  async findByEmail(email: string): Promise<User | null> {
    const { data } = await this.db.from(this.table).select('*').eq('email', email).single();
    return data as User | null;
  }
}

export const userRepository = new UserRepository();
