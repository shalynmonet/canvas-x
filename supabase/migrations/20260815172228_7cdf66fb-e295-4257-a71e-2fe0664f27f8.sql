REVOKE EXECUTE ON FUNCTION public.recompute_calibration() FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM anon, authenticated, PUBLIC;
GRANT EXECUTE ON FUNCTION public.recompute_calibration() TO service_role;