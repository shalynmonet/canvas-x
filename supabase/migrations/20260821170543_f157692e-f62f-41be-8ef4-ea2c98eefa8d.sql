ALTER TABLE public.collabs RENAME COLUMN view_payout_days TO view_window_days;

CREATE TABLE public.view_entries (
  id uuid not null default gen_random_uuid() primary key,
  collab_id uuid not null references public.collabs(id),
  post_date date not null,
  post_index integer not null default 1,
  view_window_days integer not null default 15,
  target_date date generated always as (post_date + view_window_days) stored,
  views integer,
  logged_at timestamp with time zone not null default now(),
  unique (collab_id, post_date, post_index)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.view_entries TO authenticated;
GRANT ALL ON public.view_entries TO service_role;

ALTER TABLE public.view_entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own view entries ALL" ON public.view_entries
FOR ALL TO authenticated
USING (EXISTS (SELECT 1 FROM public.collabs c WHERE c.id = view_entries.collab_id AND c.user_id = auth.uid()))
WITH CHECK (EXISTS (SELECT 1 FROM public.collabs c WHERE c.id = view_entries.collab_id AND c.user_id = auth.uid()));

INSERT INTO public.view_entries (collab_id, post_date, post_index, view_window_days, views, logged_at)
SELECT vl.collab_id,
       (c.start_date + (vl.day_number - 1))::date,
       1,
       c.view_window_days,
       vl.view_count,
       vl.logged_at
FROM public.view_logs vl
JOIN public.collabs c ON c.id = vl.collab_id;

DROP TABLE public.view_logs;