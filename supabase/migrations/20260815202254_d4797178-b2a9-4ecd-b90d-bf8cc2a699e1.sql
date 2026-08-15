CREATE TABLE public.signup_leads (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  phone TEXT,
  name TEXT,
  source TEXT NOT NULL DEFAULT 'linq',
  message TEXT,
  payload JSONB,
  status TEXT NOT NULL DEFAULT 'new',
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);
GRANT ALL ON public.signup_leads TO service_role;
ALTER TABLE public.signup_leads ENABLE ROW LEVEL SECURITY;
CREATE INDEX signup_leads_phone_idx ON public.signup_leads (phone);