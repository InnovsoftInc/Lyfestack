import type { SupabaseClient } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import { NotFoundError } from '../errors/AppError';

export abstract class BaseRepository<T extends { id: string }> {
  protected db: SupabaseClient;
  protected abstract table: string;

  constructor() {
    this.db = supabase;
  }

  async findById(id: string): Promise<T> {
    const { data, error } = await this.db.from(this.table).select('*').eq('id', id).single();
    if (error || !data) throw new NotFoundError(`${this.table} ${id} not found`);
    return data as T;
  }

  async findAll(filter?: Partial<T>): Promise<T[]> {
    let query = this.db.from(this.table).select('*');
    if (filter) {
      for (const [key, value] of Object.entries(filter)) {
        query = query.eq(key, value as string);
      }
    }
    const { data, error } = await query;
    if (error) throw error;
    return (data ?? []) as T[];
  }

  async create(payload: Omit<T, 'createdAt' | 'updatedAt'>): Promise<T> {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await this.db.from(this.table).insert(payload as any).select().single();
    if (error) throw error;
    return data as T;
  }

  async update(id: string, payload: Partial<T>): Promise<T> {
    const { data, error } = await this.db
      .from(this.table)
      .update({ ...payload, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single();
    if (error || !data) throw new NotFoundError(`${this.table} ${id} not found`);
    return data as T;
  }

  async delete(id: string): Promise<void> {
    const { error } = await this.db.from(this.table).delete().eq('id', id);
    if (error) throw error;
  }
}
