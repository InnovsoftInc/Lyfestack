import 'dotenv/config';
import { z } from 'zod';

const configSchema = z.object({
  NODE_ENV: z.enum(['development', 'staging', 'production']).default('development'),
  PORT: z.coerce.number().default(3000),
  LOG_LEVEL: z.enum(['trace', 'debug', 'info', 'warn', 'error', 'fatal']).default('debug'),

  SUPABASE_URL: z.string().url().optional(),
  SUPABASE_SERVICE_KEY: z.string().optional(),
  SUPABASE_ANON_KEY: z.string().optional(),

  OPENROUTER_API_KEY: z.string().optional(),
  OPENROUTER_MODEL: z.string().default('anthropic/claude-sonnet-4'),

  BUFFER_CLIENT_ID: z.string().optional(),
  BUFFER_CLIENT_SECRET: z.string().optional(),

  GOOGLE_CLIENT_ID: z.string().optional(),
  GOOGLE_CLIENT_SECRET: z.string().optional(),

  SENTRY_DSN: z.string().optional(),
});

const result = configSchema.safeParse(process.env);

if (!result.success) {
  console.error('Invalid environment variables:');
  console.error(JSON.stringify(result.error.format(), null, 2));
  process.exit(1);
}

export const config = result.data;
export type Config = typeof config;
