-- Daily briefs table (one per user per day)
CREATE TABLE IF NOT EXISTS public.daily_briefs (
  id           UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id      UUID        NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  date         DATE        NOT NULL,
  greeting     TEXT        NOT NULL DEFAULT '',
  summary      TEXT        NOT NULL DEFAULT '',
  insights     JSONB       NOT NULL DEFAULT '[]',
  generated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- One brief per user per day
CREATE UNIQUE INDEX IF NOT EXISTS idx_daily_briefs_user_date
  ON public.daily_briefs(user_id, date);

CREATE INDEX IF NOT EXISTS idx_daily_briefs_user_id ON public.daily_briefs(user_id);
CREATE INDEX IF NOT EXISTS idx_daily_briefs_date    ON public.daily_briefs(date);

ALTER TABLE public.daily_briefs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "daily_briefs_all_own" ON public.daily_briefs
  FOR ALL USING (auth.uid() = user_id);
