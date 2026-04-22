import { createClient } from '@supabase/supabase-js';
import { config } from '../config/config';

if (!config.SUPABASE_URL || !config.SUPABASE_SERVICE_KEY) {
  throw new Error('SUPABASE_URL and SUPABASE_SERVICE_KEY must be set');
}

export const supabase = createClient(config.SUPABASE_URL, config.SUPABASE_SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});
