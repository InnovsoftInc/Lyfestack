-- Goal status enum
DO $$ BEGIN
  CREATE TYPE goal_status AS ENUM ('DRAFT', 'ACTIVE', 'PAUSED', 'COMPLETED', 'ABANDONED');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Goals table
CREATE TABLE IF NOT EXISTS public.goals (
  id             UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id        UUID        NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  template_id    UUID,
  title          TEXT        NOT NULL,
  description    TEXT,
  status         goal_status NOT NULL DEFAULT 'DRAFT',
  target_date    DATE,
  progress_score NUMERIC(5,2) NOT NULL DEFAULT 0
                 CHECK (progress_score >= 0 AND progress_score <= 100),
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_goals_user_id ON public.goals(user_id);
CREATE INDEX IF NOT EXISTS idx_goals_status  ON public.goals(status);

CREATE TRIGGER update_goals_updated_at
  BEFORE UPDATE ON public.goals
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Milestones table
CREATE TABLE IF NOT EXISTS public.milestones (
  id           UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  goal_id      UUID        NOT NULL REFERENCES public.goals(id) ON DELETE CASCADE,
  title        TEXT        NOT NULL,
  due_date     DATE,
  completed_at TIMESTAMPTZ,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_milestones_goal_id ON public.milestones(goal_id);

CREATE TRIGGER update_milestones_updated_at
  BEFORE UPDATE ON public.milestones
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- RLS
ALTER TABLE public.goals      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.milestones ENABLE ROW LEVEL SECURITY;

CREATE POLICY "goals_all_own" ON public.goals
  FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "milestones_all_own" ON public.milestones
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.goals g
      WHERE g.id = milestones.goal_id AND g.user_id = auth.uid()
    )
  );
