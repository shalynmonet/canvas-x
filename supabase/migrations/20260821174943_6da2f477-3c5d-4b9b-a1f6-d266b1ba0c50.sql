ALTER TABLE public.collabs
  ADD COLUMN has_per_post_bonus boolean NOT NULL DEFAULT false,
  ADD COLUMN per_post_bonus_amount numeric NOT NULL DEFAULT 0,
  ADD COLUMN per_post_bonus_view_threshold integer NOT NULL DEFAULT 1000;