ALTER TABLE public.collabs ADD COLUMN same_cpm_for_all_platforms boolean NOT NULL DEFAULT true;

CREATE TABLE public.platform_rates (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  collab_id uuid NOT NULL REFERENCES public.collabs(id) ON DELETE CASCADE,
  platform text NOT NULL,
  cpm_rate numeric NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (collab_id, platform)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.platform_rates TO authenticated;
GRANT ALL ON public.platform_rates TO service_role;
ALTER TABLE public.platform_rates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own platform rates ALL" ON public.platform_rates FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM collabs c WHERE c.id = platform_rates.collab_id AND c.user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM collabs c WHERE c.id = platform_rates.collab_id AND c.user_id = auth.uid()));

ALTER TABLE public.view_entries ADD COLUMN platform_views jsonb NOT NULL DEFAULT '{}'::jsonb;