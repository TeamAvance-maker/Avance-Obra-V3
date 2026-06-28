
-- Drop all permissive write policies on public role; keep SELECT public for reads.
-- Server-side admin operations use service_role which bypasses RLS.

DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT tablename, policyname, cmd
    FROM pg_policies
    WHERE schemaname='public'
      AND (cmd IN ('INSERT','UPDATE','DELETE','ALL'))
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', r.policyname, r.tablename);
  END LOOP;
END $$;

-- Ensure SELECT public policies exist for tables that previously had ALL (so reads keep working)
CREATE POLICY pub_select ON public.materials_v2 FOR SELECT USING (true);
CREATE POLICY pub_select ON public.vale_types_v2 FOR SELECT USING (true);
CREATE POLICY pub_select ON public.vale_stages FOR SELECT USING (true);
CREATE POLICY pub_select ON public.vale_reqs FOR SELECT USING (true);
CREATE POLICY pub_select ON public.sites FOR SELECT USING (true);
CREATE POLICY pub_select ON public.site_deliveries FOR SELECT USING (true);
CREATE POLICY pub_select ON public.site_delivery_items FOR SELECT USING (true);

-- Fix security definer views: enforce caller's permissions/RLS
ALTER VIEW public.v_required SET (security_invoker = on);
ALTER VIEW public.v_received SET (security_invoker = on);
ALTER VIEW public.v_houses_executed SET (security_invoker = on);
ALTER VIEW public.v_delivered SET (security_invoker = on);
