CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users ON DELETE CASCADE,
  name TEXT NOT NULL DEFAULT '',
  phone TEXT,
  reminder_time TIME,
  reminder_enabled BOOLEAN NOT NULL DEFAULT false,
  trial_ends_at TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '7 days'),
  subscription_status TEXT NOT NULL DEFAULT 'trialing',
  stripe_customer_id TEXT,
  stripe_subscription_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own profile select" ON public.profiles FOR SELECT TO authenticated USING (auth.uid() = id);
CREATE POLICY "own profile insert" ON public.profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);
CREATE POLICY "own profile update" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

CREATE TABLE public.collabs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  brand_name TEXT NOT NULL,
  social_accounts TEXT NOT NULL DEFAULT '',
  start_date DATE NOT NULL DEFAULT current_date,
  source TEXT NOT NULL DEFAULT '',
  main_poc TEXT NOT NULL DEFAULT '',
  warmup_days INT NOT NULL DEFAULT 3 CHECK (warmup_days BETWEEN 2 AND 5),
  daily_engagement_minutes INT NOT NULL DEFAULT 20 CHECK (daily_engagement_minutes BETWEEN 10 AND 45),
  base_pay NUMERIC(10,2) NOT NULL DEFAULT 0,
  cpm_rate NUMERIC(10,2) NOT NULL DEFAULT 0,
  min_daily_posts INT NOT NULL DEFAULT 1 CHECK (min_daily_posts >= 0),
  pay_frequency TEXT NOT NULL DEFAULT 'monthly' CHECK (pay_frequency IN ('weekly','biweekly','monthly','on completion')),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','completed','paused')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.collabs TO authenticated;
GRANT ALL ON public.collabs TO service_role;
ALTER TABLE public.collabs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own collabs" ON public.collabs FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TABLE public.daily_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  collab_id UUID NOT NULL REFERENCES public.collabs(id) ON DELETE CASCADE,
  log_date DATE NOT NULL DEFAULT current_date,
  warmed_up BOOLEAN NOT NULL DEFAULT false,
  engaged BOOLEAN NOT NULL DEFAULT false,
  posted_count INT NOT NULL DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (collab_id, log_date)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.daily_logs TO authenticated;
GRANT ALL ON public.daily_logs TO service_role;
ALTER TABLE public.daily_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own daily logs" ON public.daily_logs FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.collabs c WHERE c.id = collab_id AND c.user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.collabs c WHERE c.id = collab_id AND c.user_id = auth.uid()));

CREATE TABLE public.view_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  collab_id UUID NOT NULL REFERENCES public.collabs(id) ON DELETE CASCADE,
  day_number INT NOT NULL CHECK (day_number BETWEEN 1 AND 15),
  view_count INT NOT NULL DEFAULT 0 CHECK (view_count >= 0),
  logged_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (collab_id, day_number)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.view_logs TO authenticated;
GRANT ALL ON public.view_logs TO service_role;
ALTER TABLE public.view_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own view logs" ON public.view_logs FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.collabs c WHERE c.id = collab_id AND c.user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.collabs c WHERE c.id = collab_id AND c.user_id = auth.uid()));

CREATE TABLE public.calibration_results (
  collab_type TEXT PRIMARY KEY,
  avg_warmup_days NUMERIC(4,1),
  avg_engagement_minutes NUMERIC(4,1),
  avg_min_posts NUMERIC(4,1),
  response_count INT NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.calibration_results TO anon, authenticated;
GRANT ALL ON public.calibration_results TO service_role;
ALTER TABLE public.calibration_results ENABLE ROW LEVEL SECURITY;
CREATE POLICY "calibration public read" ON public.calibration_results FOR SELECT TO anon, authenticated USING (true);

CREATE TABLE public.calibration_responses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  collab_type TEXT NOT NULL,
  warmup_days INT NOT NULL CHECK (warmup_days BETWEEN 2 AND 5),
  engagement_minutes INT NOT NULL CHECK (engagement_minutes BETWEEN 10 AND 45),
  min_posts INT NOT NULL CHECK (min_posts BETWEEN 0 AND 10),
  respondent_source TEXT NOT NULL DEFAULT 'terac',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT INSERT ON public.calibration_responses TO anon, authenticated;
GRANT ALL ON public.calibration_responses TO service_role;
ALTER TABLE public.calibration_responses ENABLE ROW LEVEL SECURITY;
CREATE POLICY "anyone can submit survey" ON public.calibration_responses FOR INSERT TO anon, authenticated WITH CHECK (true);

CREATE TABLE public.reminder_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  sent_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  collab_ids_flagged TEXT NOT NULL DEFAULT '',
  message TEXT
);
GRANT SELECT ON public.reminder_logs TO authenticated;
GRANT ALL ON public.reminder_logs TO service_role;
ALTER TABLE public.reminder_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own reminder logs" ON public.reminder_logs FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.recompute_calibration() RETURNS void
LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  INSERT INTO public.calibration_results (collab_type, avg_warmup_days, avg_engagement_minutes, avg_min_posts, response_count, updated_at)
  SELECT collab_type, round(avg(warmup_days),1), round(avg(engagement_minutes),1), round(avg(min_posts),1), count(*), now()
  FROM public.calibration_responses GROUP BY collab_type
  ON CONFLICT (collab_type) DO UPDATE SET
    avg_warmup_days = EXCLUDED.avg_warmup_days,
    avg_engagement_minutes = EXCLUDED.avg_engagement_minutes,
    avg_min_posts = EXCLUDED.avg_min_posts,
    response_count = EXCLUDED.response_count,
    updated_at = now();
$$;

CREATE OR REPLACE FUNCTION public.handle_new_user() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, name, phone, reminder_time, reminder_enabled)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'name', ''),
    NEW.raw_user_meta_data->>'phone',
    NULLIF(NEW.raw_user_meta_data->>'reminder_time','')::time,
    COALESCE(NULLIF(NEW.raw_user_meta_data->>'reminder_time','') IS NOT NULL, false)
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

INSERT INTO public.calibration_results (collab_type, avg_warmup_days, avg_engagement_minutes, avg_min_posts, response_count)
VALUES ('new fashion brand', NULL, NULL, NULL, 0),
       ('established beauty brand', NULL, NULL, NULL, 0),
       ('app/software brand', NULL, NULL, NULL, 0),
       ('agency', NULL, NULL, NULL, 0);