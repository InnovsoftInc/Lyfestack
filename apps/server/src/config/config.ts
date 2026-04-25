import 'dotenv/config';
import { z } from 'zod';

const isProduction = process.env['NODE_ENV'] === 'production';

const configSchema = z.object({
  NODE_ENV: z.enum(['development', 'staging', 'production']).default('development'),
  PORT: z.coerce.number().default(3000),
  LOG_LEVEL: z.enum(['trace', 'debug', 'info', 'warn', 'error', 'fatal']).default('debug'),

  SUPABASE_URL: z.string().url().optional(),
  SUPABASE_SERVICE_KEY: z.string().optional(),
  SUPABASE_ANON_KEY: z.string().optional(),
  DATABASE_URL: z.string().optional(),

  BUFFER_CLIENT_ID: z.string().optional(),
  BUFFER_CLIENT_SECRET: z.string().optional(),

  GOOGLE_CLIENT_ID: z.string().optional(),
  GOOGLE_CLIENT_SECRET: z.string().optional(),

  EXPO_PUSH_ACCESS_TOKEN: z.string().optional(),
  APP_BASE_URL: isProduction
    ? z.string().url()
    : z.string().default('http://localhost:3000'),

  SENTRY_DSN: z.string().optional(),

  OPENCLAW_GATEWAY_URL: z.string().url().optional(),
  OPENCLAW_GATEWAY_TOKEN: z.string().optional(),
  LYFESTACK_WEBHOOK_SECRET: z.string().optional(),
});

const result = configSchema.safeParse(process.env);

if (!result.success) {
  console.error('Invalid environment variables:');
  console.error(JSON.stringify(result.error.format(), null, 2));
  process.exit(1);
}

export const config = result.data;
export type Config = typeof config;
