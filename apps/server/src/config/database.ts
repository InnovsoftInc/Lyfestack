import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { config } from './config';

let _supabase: SupabaseClient | null = null;

export function getSupabaseClient(): SupabaseClient {
  if (!_supabase) {
    if (!config.SUPABASE_URL || !config.SUPABASE_SERVICE_KEY) {
      throw new Error('SUPABASE_URL and SUPABASE_SERVICE_KEY must be set');
    }
    _supabase = createClient(config.SUPABASE_URL, config.SUPABASE_SERVICE_KEY, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });
  }
  return _supabase;
}

export async function checkDatabaseConnection(): Promise<boolean> {
  try {
    if (!config.SUPABASE_URL || !config.SUPABASE_SERVICE_KEY) {
      return false;
    }
    const client = getSupabaseClient();
    const { error } = await client.from('users').select('id').limit(1);
    return error === null || error.code === 'PGRST116';
  } catch {
    return false;
  }
}
