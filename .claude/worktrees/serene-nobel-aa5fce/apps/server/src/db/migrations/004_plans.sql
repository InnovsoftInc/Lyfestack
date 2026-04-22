-- Plans table (a plan groups one or more goals)
CREATE TABLE IF NOT EXISTS public.plans (
  id          UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id     UUID        NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  title       TEXT        NOT NULL,
  description TEXT,
  status      goal_status NOT NULL DEFAULT 'DRAFT',
  start_date  DATE        NOT NULL,
  end_date    DATE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_plans_user_id ON public.plans(user_id);
CREATE INDEX IF NOT EXISTS idx_plans_status  ON public.plans(status);

CREATE TRIGGER update_plans_updated_at
  BEFORE UPDATE ON public.plans
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Many-to-many join between plans and goals
CREATE TABLE IF NOT EXISTS public.plan_goals (
  plan_id    UUID NOT NULL REFERENCES public.plans(id) ON DELETE CASCADE,
  goal_id    UUID NOT NULL REFERENCES public.goals(id) ON DELETE CASCADE,
  PRIMARY KEY (plan_id, goal_id)
);

CREATE INDEX IF NOT EXISTS idx_plan_goals_goal_id ON public.plan_goals(goal_id);

ALTER TABLE public.plans      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.plan_goals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "plans_all_own" ON public.plans
  FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "plan_goals_all_own" ON public.plan_goals
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.plans p
      WHERE p.id = plan_goals.plan_id AND p.user_id = auth.uid()
    )
  );
