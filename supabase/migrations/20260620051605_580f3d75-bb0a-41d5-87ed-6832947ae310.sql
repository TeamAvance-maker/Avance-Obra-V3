DROP POLICY IF EXISTS "deletion_log readable" ON public.deletion_log;
DROP POLICY IF EXISTS "deletion_log insertable" ON public.deletion_log;
REVOKE ALL ON public.deletion_log FROM anon;
REVOKE ALL ON public.deletion_log FROM authenticated;
ALTER TABLE public.deletion_log ENABLE ROW LEVEL SECURITY;
GRANT ALL ON public.deletion_log TO service_role;