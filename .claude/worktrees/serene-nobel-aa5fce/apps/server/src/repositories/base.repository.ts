import type { SupabaseClient } from '@supabase/supabase-js';

export interface FindOptions {
  limit?: number;
  offset?: number;
  orderBy?: { column: string; ascending?: boolean };
}

export abstract class BaseRepository<T, TInsert = Partial<T>> {
  constructor(
    protected readonly client: SupabaseClient,
    protected readonly tableName: string,
  ) {}

  protected abstract mapRow(row: Record<string, unknown>): T;

  async findById(id: string): Promise<T | null> {
    const { data, error } = await this.client
      .from(this.tableName)
      .select('*')
      .eq('id', id)
      .single();

    if (error) {
      if (error.code === 'PGRST116') return null;
      throw error;
    }

    return data ? this.mapRow(data as Record<string, unknown>) : null;
  }

  async findAll(options?: FindOptions): Promise<T[]> {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let query: any = this.client.from(this.tableName).select('*');

    if (options?.orderBy) {
      query = query.order(options.orderBy.column, {
        ascending: options.orderBy.ascending ?? true,
      });
    }
    if (options?.limit !== undefined) {
      query = query.limit(options.limit);
    }
    if (options?.offset !== undefined) {
      query = query.range(
        options.offset,
        options.offset + ((options.limit ?? 10) - 1),
      );
    }

    const { data, error } = await query;
    if (error) throw error;
    return ((data as Record<string, unknown>[]) ?? []).map((row) => this.mapRow(row));
  }

  async create(insertData: TInsert): Promise<T> {
    const { data, error } = await this.client
      .from(this.tableName)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .insert(insertData as any)
      .select()
      .single();

    if (error) throw error;
    if (!data) throw new Error('Insert returned no data');
    return this.mapRow(data as Record<string, unknown>);
  }

  async update(id: string, updateData: Partial<TInsert>): Promise<T | null> {
    const { data, error } = await this.client
      .from(this.tableName)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .update(updateData as any)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      if (error.code === 'PGRST116') return null;
      throw error;
    }

    return data ? this.mapRow(data as Record<string, unknown>) : null;
  }

  async delete(id: string): Promise<boolean> {
    const { error } = await this.client.from(this.tableName).delete().eq('id', id);
    if (error) throw error;
    return true;
  }

  async count(filters?: Record<string, unknown>): Promise<number> {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let query: any = this.client.from(this.tableName).select('*', { count: 'exact', head: true });

    if (filters) {
      for (const [key, value] of Object.entries(filters)) {
        query = query.eq(key, value as string);
      }
    }

    const { count, error } = await query;
    if (error) throw error;
    return count ?? 0;
  }
}
