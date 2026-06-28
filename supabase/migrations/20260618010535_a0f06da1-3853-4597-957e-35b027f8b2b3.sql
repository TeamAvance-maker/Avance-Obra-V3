DROP POLICY IF EXISTS "deletion_log insertable" ON public.deletion_log;
REVOKE INSERT ON public.deletion_log FROM anon, authenticated;