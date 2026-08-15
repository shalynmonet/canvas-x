ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS timezone TEXT DEFAULT 'UTC';

UPDATE public.profiles SET timezone = 'UTC' WHERE timezone IS NULL OR timezone = '';

CREATE OR REPLACE FUNCTION public.handle_new_user() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, name, phone, reminder_time, reminder_enabled, timezone)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'name', ''),
    NEW.raw_user_meta_data->>'phone',
    NULLIF(NEW.raw_user_meta_data->>'reminder_time','')::time,
    COALESCE(NULLIF(NEW.raw_user_meta_data->>'reminder_time','') IS NOT NULL, false),
    COALESCE(NULLIF(NEW.raw_user_meta_data->>'timezone',''), 'UTC')
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;