-- Enums
DO $$ BEGIN
  CREATE TYPE task_type AS ENUM ('ACTION', 'HABIT', 'MILESTONE', 'REFLECTION', 'SOCIAL');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE task_status AS ENUM (
    'PENDING', 'PENDING_APPROVAL', 'APPROVED', 'IN_PROGRESS',
    'COMPLETED', 'SKIPPED', 'FAILED'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE approval_state AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'MODIFIED');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Tasks table
CREATE TABLE IF NOT EXISTS public.tasks (
  id               UUID           PRIMARY KEY DEFAULT uuid_generate_v4(),
  goal_id          UUID           NOT NULL REFERENCES public.goals(id) ON DELETE CASCADE,
  user_id          UUID           NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  title            TEXT           NOT NULL,
  description      TEXT,
  type             task_type      NOT NULL DEFAULT 'ACTION',
  status           task_status    NOT NULL DEFAULT 'PENDING',
  approval_state   approval_state NOT NULL DEFAULT 'PENDING',
  scheduled_for    TIMESTAMPTZ,
  completed_at     TIMESTAMPTZ,
  duration_minutes INTEGER,
  confidence_score NUMERIC(3,2)
                   CHECK (confidence_score >= 0 AND confidence_score <= 1),
  created_at       TIMESTAMPTZ    NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ    NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tasks_goal_id      ON public.tasks(goal_id);
CREATE INDEX IF NOT EXISTS idx_tasks_user_id      ON public.tasks(user_id);
CREATE INDEX IF NOT EXISTS idx_tasks_status       ON public.tasks(status);
CREATE INDEX IF NOT EXISTS idx_tasks_scheduled    ON public.tasks(scheduled_for);

CREATE TRIGGER update_tasks_updated_at
  BEFORE UPDATE ON public.tasks
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tasks_all_own" ON public.tasks
  FOR ALL USING (auth.uid() = user_id);
