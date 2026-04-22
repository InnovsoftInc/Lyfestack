-- Agent role enum
DO $$ BEGIN
  CREATE TYPE agent_role AS ENUM ('PLANNER', 'EXECUTOR', 'REVIEWER', 'COACH');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Agent actions table (records every AI agent decision for audit + rollback)
CREATE TABLE IF NOT EXISTS public.agent_actions (
  id               UUID           PRIMARY KEY DEFAULT uuid_generate_v4(),
  agent_role       agent_role     NOT NULL,
  user_id          UUID           NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  action           TEXT           NOT NULL,
  payload          JSONB          NOT NULL DEFAULT '{}',
  approval_state   approval_state NOT NULL DEFAULT 'PENDING',
  rationale        TEXT           NOT NULL DEFAULT '',
  confidence_score NUMERIC(3,2)
                   CHECK (confidence_score >= 0 AND confidence_score <= 1),
  rollback_plan    TEXT,
  monitoring_window INTEGER        NOT NULL DEFAULT 0,
  created_at       TIMESTAMPTZ    NOT NULL DEFAULT NOW(),
  resolved_at      TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_agent_actions_user_id        ON public.agent_actions(user_id);
CREATE INDEX IF NOT EXISTS idx_agent_actions_approval_state ON public.agent_actions(approval_state);
CREATE INDEX IF NOT EXISTS idx_agent_actions_created_at     ON public.agent_actions(created_at);

ALTER TABLE public.agent_actions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "agent_actions_all_own" ON public.agent_actions
  FOR ALL USING (auth.uid() = user_id);
