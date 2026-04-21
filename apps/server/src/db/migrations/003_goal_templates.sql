-- Goal templates table (admin-managed, publicly readable)
CREATE TABLE IF NOT EXISTS public.goal_templates (
  id                    UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  name                  TEXT        NOT NULL,
  description           TEXT,
  category              TEXT        NOT NULL,
  duration_days         INTEGER     NOT NULL DEFAULT 30,
  diagnostic_questions  JSONB       NOT NULL DEFAULT '[]',
  milestones            JSONB       NOT NULL DEFAULT '[]',
  allowed_actions       JSONB       NOT NULL DEFAULT '[]',
  leading_indicators    JSONB       NOT NULL DEFAULT '[]',
  is_active             BOOLEAN     NOT NULL DEFAULT TRUE,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_goal_templates_category  ON public.goal_templates(category);
CREATE INDEX IF NOT EXISTS idx_goal_templates_is_active ON public.goal_templates(is_active);

CREATE TRIGGER update_goal_templates_updated_at
  BEFORE UPDATE ON public.goal_templates
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

ALTER TABLE public.goal_templates ENABLE ROW LEVEL SECURITY;

-- Everyone can read active templates; only service role can write
CREATE POLICY "goal_templates_public_read" ON public.goal_templates
  FOR SELECT USING (is_active = TRUE);
