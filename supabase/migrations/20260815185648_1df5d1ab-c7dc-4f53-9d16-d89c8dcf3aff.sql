DROP POLICY IF EXISTS "calibration public read" ON public.calibration_results;

CREATE POLICY "calibration authenticated read"
ON public.calibration_results
FOR SELECT
TO authenticated
USING (true);

REVOKE SELECT ON public.calibration_results FROM anon;
GRANT SELECT ON public.calibration_results TO authenticated;
GRANT ALL ON public.calibration_results TO service_role;

-- Survey submissions remain insert-only for the public; no SELECT policy on purpose.
REVOKE SELECT, UPDATE, DELETE ON public.calibration_responses FROM anon;
REVOKE SELECT, UPDATE, DELETE ON public.calibration_responses FROM authenticated;
GRANT INSERT ON public.calibration_responses TO anon, authenticated;
GRANT ALL ON public.calibration_responses TO service_role;