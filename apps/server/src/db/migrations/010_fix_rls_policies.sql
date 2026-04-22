-- Fix RLS policies: add service_role bypass for server-side inserts
-- Also convert goals.template_id from UUID to TEXT (templates use string IDs)

-- ─── goals.template_id: UUID → TEXT ────────────────────────────────────────
-- The hardcoded template registry uses string IDs (e.g. 'tpl-fitness-beginner'),
-- not valid UUIDs, so relax the column type to TEXT.
ALTER TABLE public.goals
  ALTER COLUMN template_id TYPE TEXT USING template_id::TEXT;

-- ─── Service-role bypass policies ───────────────────────────────────────────
-- The server uses the Supabase service role key which has no auth.uid() context,
-- so it's blocked by user-scoped RLS policies. These policies grant full access
-- to the service role so backend inserts/updates succeed.

DO $$ BEGIN
  CREATE POLICY "service_role_bypass_goals" ON public.goals
    FOR ALL TO service_role USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "service_role_bypass_milestones" ON public.milestones
    FOR ALL TO service_role USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "service_role_bypass_goal_templates" ON public.goal_templates
    FOR ALL TO service_role USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- plans table (from 004_plans.sql)
DO $$ BEGIN
  CREATE POLICY "service_role_bypass_plans" ON public.plans
    FOR ALL TO service_role USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- tasks table (from 005_tasks.sql)
DO $$ BEGIN
  CREATE POLICY "service_role_bypass_tasks" ON public.tasks
    FOR ALL TO service_role USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- daily_briefs table (from 006_daily_briefs.sql)
DO $$ BEGIN
  CREATE POLICY "service_role_bypass_daily_briefs" ON public.daily_briefs
    FOR ALL TO service_role USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- push_tokens table (from 008_push_tokens.sql)
DO $$ BEGIN
  CREATE POLICY "service_role_bypass_push_tokens" ON public.push_tokens
    FOR ALL TO service_role USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- users table (from 001_users.sql)
DO $$ BEGIN
  CREATE POLICY "service_role_bypass_users" ON public.users
    FOR ALL TO service_role USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
