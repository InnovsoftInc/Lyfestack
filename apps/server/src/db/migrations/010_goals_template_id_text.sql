-- template_id stores slug strings like "tpl-solo-business", not UUIDs
ALTER TABLE public.goals ALTER COLUMN template_id TYPE TEXT USING template_id::TEXT;
